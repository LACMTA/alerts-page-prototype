const BUS_AGENCY_ID = "lametro";
const RAIL_AGENCY_ID = "lametro-rail";

const BUS_ALERTS =
  "https://lbwlhl4z4pktjvxw3tm6emxfui0kwjiv.lambda-url.us-west-1.on.aws/";
const RAIL_ALERTS =
  "https://5cgdcfl7csnoiymgfhjp5bqgii0yxifx.lambda-url.us-west-1.on.aws/";

const SHOW_CX_SURVEY_POPUP = false;

// not used
// const DATA_SOURCE_PROD = 'https://pveqxgqnqpmamg2lfxgv4akoau0rabtm.lambda-url.us-west-1.on.aws/';
// const DATA_SOURCE_TEST = 'alerts_enhanced.json';
// const DATA_SOURCE_EMPTY = 'alerts_empty.json';

// const DATA_SOURCE_COMBINED = 'https://7b9l1n0nb6.execute-api.us-west-1.amazonaws.com/alerts-combined';
// const DATA_SOURCE = DATA_SOURCE_COMBINED;

const DATA_SOURCE = [BUS_ALERTS, RAIL_ALERTS];

const SERVICE = {
  RAIL: "rail",
  BUS: "bus",
  ACCESS: "access",
};

const STATUS = {
  ALL: "all",
  CURRENT: "current",
  UPCOMING: "upcoming",
};

const LINE_ICONS = {
  801: "https://lacmta.github.io/metro-iconography/Service_ALine.svg",
  802: "https://lacmta.github.io/metro-iconography/Service_BLine.svg",
  803: "https://lacmta.github.io/metro-iconography/Service_CLine.svg",
  804: "https://lacmta.github.io/metro-iconography/Service_ELine2.svg",
  805: "https://lacmta.github.io/metro-iconography/Service_DLine.svg",
  807: "https://lacmta.github.io/metro-iconography/Service_KLine.svg",
  901: "https://lacmta.github.io/metro-iconography/Service_GLine.svg",
  910: "https://lacmta.github.io/metro-iconography/Service_JLine.svg",
  950: "https://lacmta.github.io/metro-iconography/Service_JLine.svg",
};

const ACCESS_ICON = "img/elevator-white.svg";

// Set default on load to show Current Bus alerts:
let serviceSelected = SERVICE.BUS;
let statusSelected = STATUS.CURRENT;

let feedTimestamp = "";
let alertsByLine = {};
// let alertsByStop = {};

let dataReturned = false;

let railAlerts = {
  all: [],
  current: {},
  upcoming: {},
};
let busAlerts = {
  all: [],
  current: {},
  upcoming: {},
};
let accessAlerts = {
  all: [],
  current: [],
  upcoming: [],
};

let allAlerts = {
  rail: railAlerts,
  bus: busAlerts,
  access: accessAlerts,
};

let systemwideAlerts = [];

const fetchPromises = DATA_SOURCE.map((url) =>
  fetch(url, { method: "GET" }).then((response) => {
    if (response.ok) {
      return response.json();
    }
    throw new Error("Network response was not ok.");
  }),
);

Promise.all(fetchPromises)
  .then((data) => {
    console.log(data);
    // updateLastUpdated(data.header.timestamp);
    processAlerts(data);
  })
  .catch((error) => {
    console.error(`Request failed: `, error);
  });

function updateLastUpdated(time) {
  let result = formatDate(time);
  feedTimestamp = result;
}

function formatDate(time) {
  const date = new Date(time);

  let result = date.toLocaleString("en-US", {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  return result;
}

// function createAlertObjectArray(alert) {
//     let result = [];

//     alert.informedEntities.forEach(entity => {
//         let alertObj = {
//             'id': alert.id,
//             'route_id': entity.routeId,
//             'stop_id': entity.stop_id,
//             'start': alert.activePeriods[0].start,
//             'end': alert.activePeriods[0].end,
//             'headerText': alert.headerText,
//             'descriptionText': alert.descriptionText
//         };

//         result.push(alertObj);
//     });

//     return result;
// }

function categorizeAndStoreAlert(routeId, alert, alertsArray) {
  let alertStatus = isUpcoming(alert) ? "upcoming" : "current";

  if (alertsArray[alertStatus][routeId] == undefined) {
    alertsArray[alertStatus][routeId] = [];
  }

  alertsArray[alertStatus][routeId].push(alert);
}

function sortAlertsByEffectiveDate(alerts) {
  alerts.sort((a, b) => {
    let aStartTime = new Date(formatDate(a.activePeriods[0].start));
    let bStartTime = new Date(formatDate(b.activePeriods[0].start));

    // sort by start time, then by end time (if exists)
    if (aStartTime < bStartTime) {
      if (a.activePeriods[0].end && b.activePeriods[0].end) {
        let aEndTime = new Date(formatDate(a.activePeriods[0].end));
        let bEndTime = new Date(formatDate(b.activePeriods[0].end));

        if (aEndTime < bEndTime) {
          return -1;
        } else if (aEndTime > bEndTime) {
          return 1;
        } else {
          return 0;
        }
      } else if (a.activePeriods[0].end) {
        return -1;
      } else {
        return 1;
      }
    } else if (aStartTime > bStartTime) {
      return 1;
    } else {
      return 0;
    }
  });
}

function combineAlerts(alerts) {
  let target = alerts["all"];

  for (let route in alerts["current"]) {
    if (target[route] == undefined) {
      target[route] = [];
    }

    target[route] = target[route].concat(alerts["current"][route]);
  }

  for (let route in alerts["upcoming"]) {
    if (target[route] == undefined) {
      target[route] = [];
    }

    target[route] = target[route].concat(alerts["upcoming"][route]);
  }
}

function combineAccessAlerts(alerts) {
  let target = alerts["all"];

  for (let item in alerts["current"]) {
    target = target.concat(alerts["current"][item]);
  }

  for (let item in alerts["upcoming"]) {
    target = target.concat(alerts["upcoming"][item]);
  }
}

function processAlerts(data) {
  // Data is an array of responses from each API called
  // Each response is an array of alerts
  // Loop through each alert
  // Initial check to see if alert is valid:
  // - informed_entity exists and is not empty
  // - active_period exists
  // Handle the alert based on whether it is an accessibility alert or not:
  // - Check if this is an accessibility alert based on effect/effect_detail
  // - Otherwise this is a bus/rail alert
  // Handling function returns a simplified alert object.
  // Store the simplified alert object in the appropriate array, passing in the route_id, alert, and alertsArray
  // Combine the rail, bus, and access alerts
  // Update the view
  let i = 0;
  let n = 0;

  data.forEach((alertFeed) => {
    alertFeed.forEach((alert) => {
      console.debug("-----------------------------------");

      let today = new Date();
      let endDate = alert.activePeriods[0].end
        ? new Date(formatDate(alert.activePeriods[0].end))
        : null;

      // Check if informed_entity exists and is not empty
      if (!alert.informedEntities) {
        console.error(
          `Alert ${alert.id} has no associated lines. Informed_entity doesn't exist.`,
        );
      } else if (alert.informedEntities.length == 0) {
        console.error(
          `Alert ${alert.id} has no associated lines. Informed_entity length is 0`,
        );
      } else if (!alert.activePeriods) {
        console.error(`Alert ${alert.id} has no active_period`);
      } else if (endDate != null && endDate < today) {
        console.error(`Alert ${alert.id} is expired`);
      } else {
        // This alert should be valid
        let targetServiceArr;
        let affectedRoutes = [];
        let accumulatedAlerts = [];

        // Check if this is an accessibility alert from Airtable
        if (alert.effect == "ACCESSIBILITY_ISSUE") {
          // This is an accessibility-related alert.

          console.debug(`Alert ${alert.id} is an accessibility alert`);
          targetServiceArr = allAlerts.access;
          i++;
        } else if (
          alert.headerText.toLowerCase().includes("elevator") ||
          alert.headerText.toLowerCase().includes("escalator") ||
          alert.descriptionText.toLowerCase().includes("elevator") ||
          alert.descriptionText.toLowerCase().includes("escalator")
        ) {
          // This is an accessibility-related alert from Swiftly

          console.debug(`Alert ${alert.id} is an access alert from Swiftly`);
          targetServiceArr = allAlerts.access;
          i++;
        } else if (alert.agencyId == RAIL_AGENCY_ID) {
          // This is a rail alert.

          console.debug(`Alert ${alert.id} is a rail alert`);
          targetServiceArr = allAlerts.rail;
          i++;
        } else if (alert.agencyId == BUS_AGENCY_ID) {
          // This is a bus alert.

          console.debug(`Alert ${alert.id} is a bus alert`);
          targetServiceArr = allAlerts.bus;
          i++;
        } else {
          // No service type assigned to this alert, return and process the next alert.
          return;
        }

        alert.informedEntities.forEach((elem, i) => {
          n = 0;

          if (elem.routeId) {
            let routeId = elem.routeId;

            if (!affectedRoutes.includes(routeId)) {
              // simplifiedAlert = alert;
              // simplifiedalert.informedEntities = [elem];
              affectedRoutes.push(routeId);

              accumulatedAlerts.push({
                routeId: routeId,
                alert: alert,
              });

              console.debug(`Route ${routeId} added to affectedRoutes`);
            }    
          }
        });

        accumulatedAlerts.forEach((elem) => {
          n++;
          if (elem.routeId == undefined) {
            // This is a systemwide alert
            systemwideAlerts.push(alert);
          } else {
            categorizeAndStoreAlert(
              splitLine(elem.routeId),
              elem.alert,
              targetServiceArr,
            );
          }
        });

        console.debug(`${n} alerts added for alertId: ${alert.id}`);
      }
    });
  });

  console.log(`${i} alerts processed`);

  busAlerts = allAlerts.bus;
  railAlerts = allAlerts.rail;
  accessAlerts = allAlerts.access;

  combineAlerts(railAlerts);
  combineAlerts(busAlerts);
  combineAlerts(accessAlerts);

  // If DOM is loaded, updateView(). Otherwise, wait for DOM to load.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateView);
  } else {
    updateView();
  }
}

function splitLine(line) {
  // Remove hyphen and version number
  let i = line.indexOf("-");
  if (i == -1) {
    return line;
  }
  return line.substring(0, i);
}

function splitStop(stop) {
  // Remove alpha characters
  return stop.replace(/\D/g, "");
}

function isUpcoming(alert) {
  let today = new Date();
  let startTime = new Date(formatDate(alert.activePeriods[0].start));
  let status = today < startTime;
  return status;
}

document.addEventListener("DOMContentLoaded", () => {
  // Add event listeners to service navigation buttons

  // check if #service-nav--rail element exists
  if (document.querySelector("#service-nav--rail")) {
    document
      .querySelector("#service-nav--rail")
      .addEventListener("click", handleServiceClick.bind(SERVICE.RAIL));
  }

  if (document.querySelector("#service-nav--bus")) {
    document
      .querySelector("#service-nav--bus")
      .addEventListener("click", handleServiceClick.bind(SERVICE.BUS));
  }

  if (document.querySelector("#service-nav--access")) {
    document
      .querySelector("#service-nav--access")
      .addEventListener("click", handleServiceClick.bind(SERVICE.ACCESS));
  }

  // Add event listeners to status navigation buttons
  if (document.querySelector("#status-nav--all")) {
    document
      .querySelector("#status-nav--all")
      .addEventListener("click", handleStatusClick.bind(STATUS.ALL));
  }

  if (document.querySelector("#status-nav--current")) {
    document
      .querySelector("#status-nav--current")
      .addEventListener("click", handleStatusClick.bind(STATUS.CURRENT));
  }

  if (document.querySelector("#status-nav--upcoming")) {
    document
      .querySelector("#status-nav--upcoming")
      .addEventListener("click", handleStatusClick.bind(STATUS.UPCOMING));
  }

  // Modal Popup Start

  /****** Modal Overlay */
  const modalOverlay = document.getElementById("modalOverlay");

  if (SHOW_CX_SURVEY_POPUP) {
    const closeModalBtn = document.getElementById("closeModal");
    const modalButtons = document.querySelectorAll(".modalButton");

    function openModal() {
      modalOverlay.classList.add("active");
      modalOverlay.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      modalOverlay.classList.remove("active");
      modalOverlay.setAttribute("aria-hidden", "true");
    }

    closeModalBtn.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    modalButtons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        button.style.transition = "background-color 0.5s ease-in-out";
        button.style.backgroundColor = "white"; // Change to your desired color
      });

      button.addEventListener("mouseleave", () => {
        button.style.transition = "background-color 0.5s ease-in-out";
        button.style.backgroundColor = ""; // Resets to default
      });
    });

    // Show modal popup

    openModal();
  } else {
    // remove modalOverlay from DOM if not showing the survey popup
    if (modalOverlay) {
      modalOverlay.remove();
    }
  }

  // Modal Popup End

  updateView();
});

function handleServiceClick(e) {
  document
    .querySelectorAll(".nav-buttons__button")
    .forEach((nav) => nav.classList.remove("nav-buttons__button--selected"));

  switch (this.toString()) {
    case SERVICE.RAIL:
      serviceSelected = SERVICE.RAIL;
      document
        .querySelector("#service-nav--rail")
        .classList.add("nav-buttons__button--selected");
      break;
    case SERVICE.BUS:
      serviceSelected = SERVICE.BUS;
      document
        .querySelector("#service-nav--bus")
        .classList.add("nav-buttons__button--selected");
      break;
    case SERVICE.ACCESS:
      serviceSelected = SERVICE.ACCESS;
      document
        .querySelector("#service-nav--access")
        .classList.add("nav-buttons__button--selected");
      break;
  }

  updateView();
}

function handleStatusClick(e) {
  document
    .querySelectorAll(".nav-tabs__button")
    .forEach((nav) => nav.classList.remove("nav-tabs__button--selected"));

  switch (this.toString()) {
    case STATUS.ALL:
      statusSelected = STATUS.ALL;
      document
        .querySelector("#status-nav--all")
        .classList.add("nav-tabs__button--selected");

      console.log("all clicked");
      break;
    case STATUS.CURRENT:
      statusSelected = STATUS.CURRENT;
      document
        .querySelector("#status-nav--current")
        .classList.add("nav-tabs__button--selected");

      console.log("current clicked");
      break;
    case STATUS.UPCOMING:
      statusSelected = STATUS.UPCOMING;
      document
        .querySelector("#status-nav--upcoming")
        .classList.add("nav-tabs__button--selected");

      console.log("upcoming clicked");
      break;
  }

  updateView();
}

function getStatusSelected() {
  switch (statusSelected) {
    case STATUS.ALL:
      return "current or upcoming";
    case STATUS.CURRENT:
      return "current";
    case STATUS.UPCOMING:
      return "upcoming";
  }
  return;
}

function getServiceSelected() {
  switch (serviceSelected) {
    case SERVICE.RAIL:
      return "trains";
    case SERVICE.BUS:
      return "buses";
    case SERVICE.ACCESS:
      return "elevators/escalators";
  }
  return;
}

function updateAccessView() {
  let filteredAlerts = accessAlerts[statusSelected];
  let alertList = document.querySelector("#alert-list__content");
  alertList.innerHTML = "";

  // temporarily show a 'coming soon message'
  // alertList.innerHTML = `<div>Coming soon!<br><br></div><div>For now, you can still view <a href="https://x.com/metrolaelevator" target="_blank">Metro Elevator Alerts on X, formerly Twitter.</a></div>`;
  // return;
  // end of temporary message

  let service = getServiceSelected();
  let nowvsLater = getStatusSelected();

  let elevatorMessage = document.createElement("div");
  elevatorMessage.classList.add("alert-item");
  let elevatorMessageText = document.createElement("div");
  elevatorMessageText.innerHTML = `If you encounter an elevator or escalator problem not listed here, please report via our <a href="https://www.metro.net/riding/la-metro-transit-watch-app/" target="_blank">TransitWatch App</a> or inform Metro staff at station.`;
  elevatorMessage.appendChild(elevatorMessageText);
  alertList.appendChild(elevatorMessage);

  if (Object.keys(filteredAlerts).length == 0) {
    let noAlerts = document.createElement("div");
    noAlerts.classList.add("alert-item");
    noAlerts.innerHTML = `There are no ${nowvsLater} alerts for ${service}.`; // Removed Last Updated day/time because Swiftly doesn't provide it.
    alertList.appendChild(noAlerts);
  } else {
    for (let item in filteredAlerts) {
      sortAlertsByEffectiveDate(filteredAlerts[item]);
      filteredAlerts[item].forEach((alert) => {
        // Create alert-item element
        let newAlert = document.createElement("div");
        newAlert.classList.add("alert-item");
        newAlert.setAttribute("data-alert-id", alert.id);

        // Create icon element
        let icon = document.createElement("div");
        icon.classList.add("alert-item__icon");
        icon.classList.add("alert-item__icon--rail");

        let lineIcon = document.createElement("img");

        lineIcon.src = LINE_ICONS[item];
        icon.appendChild(lineIcon);

        let content = document.createElement("div");
        content.classList.add("alert-item__content");

        let content_title = document.createElement("div");
        content_title.classList.add("alert-item__title");
        content_title.innerHTML = alert.headerText;

        let content_description = document.createElement("div");
        content_description.classList.add("alert-item__description");

        let descriptionText = alert.descriptionText.replaceAll("\n", "<br>");

        content_description.innerHTML +=
          descriptionText.length > 0 ? descriptionText + "<br>" : "";

        content_description.innerHTML +=
          "<br>Starting on: " + formatDate(alert.activePeriods[0].start);
        if (alert.activePeriods[0].end) {
          content_description.innerHTML +=
            "<br>Ending on: " + formatDate(alert.activePeriods[0].end);
        } else {
          content_description.innerHTML += "<br>No end date scheduled yet.";
        }

        content.appendChild(content_title);
        content.appendChild(content_description);

        // Create status
        let status = document.createElement("div");
        status.classList.add("alert-item__status");

        let status_badge = document.createElement("div");

        if (isUpcoming(alert)) {
          status_badge.classList.add("alert-item__status--upcoming");
          status_badge.innerHTML = "Upcoming";
        } else {
          status_badge.classList.add("alert-item__status--current");
          status_badge.innerHTML = "Current";
        }

        status.appendChild(status_badge);

        // Add to page
        newAlert.appendChild(icon);
        newAlert.appendChild(content);
        newAlert.appendChild(status);

        alertList.appendChild(newAlert);
      });
    }
  }
}

function updateView() {
  let filteredAlerts = [];
  let service = getServiceSelected();
  let nowvsLater = getStatusSelected();
  let routeName = "";

  if (systemwideAlerts.length > 0) {
    // Clear systemwide alerts
    let systemwideAlertList = document.querySelector("#systemwideAlertList");
    systemwideAlertList.innerHTML = "";

    // Use just the first alert FOR NOW. THIS IS A SHITTY FIX TO AVOID DUPLICATED SYSTEMWIDE ALERTS
    // let alert = systemwideAlerts[0];

    systemwideAlerts.forEach((alert, index) => {
      // Create alert-item element
      let newAlert = document.createElement("div");
      newAlert.classList.add("systemwideAlertItem");
      newAlert.setAttribute("data-alert-id", alert.id);

      let systemwideAlertText = `<strong>${alert.headerText}:</strong> ${alert.descriptionText.replaceAll("\n", "<br>")}`;

      newAlert.innerHTML = systemwideAlertText;
      systemwideAlertList.appendChild(newAlert);

      // undo display: none
      systemwideAlertList.style.display = "flex";
    });
  }

  switch (serviceSelected) {
    case SERVICE.RAIL:
      filteredAlerts = railAlerts[statusSelected];
      break;
    case SERVICE.BUS:
      filteredAlerts = busAlerts[statusSelected];
      break;
    case SERVICE.ACCESS:
      updateAccessView();
      return;
  }

  let alertList = document.querySelector("#alert-list__content");
  alertList.innerHTML = "";

  if (Object.keys(filteredAlerts).length == 0) {
    if (dataReturned) {
      let noAlerts = document.createElement("div");
      noAlerts.classList.add("alert-item");
      noAlerts.innerHTML = `There are no ${nowvsLater} alerts for ${service}. Last updated: ${feedTimestamp}.`;

      alertList.appendChild(noAlerts);
    }
  } else {
    // Loop through each key in the filteredAlerts object
    for (let item in filteredAlerts) {
      // Sort the alerts for this route.
      sortAlertsByEffectiveDate(filteredAlerts[item]);

      // Display the alerts for this route.
      filteredAlerts[item].forEach((alert) => {
        let isAccessAlert = false;

        // Create alert-item element
        let newAlert = document.createElement("div");
        newAlert.classList.add("alert-item");
        newAlert.setAttribute("data-alert-id", alert.id);

        // Create icon element
        let icon = document.createElement("div");
        icon.classList.add("alert-item__icon");

        // Determine which service to generate a display for
        switch (serviceSelected) {
          case SERVICE.RAIL:
            icon.classList.add("alert-item__icon--rail");

            let railRoute = splitLine(item);
            let railIcon = document.createElement("img");

            switch (railRoute) {
              case "801":
                railIcon.src = LINE_ICONS["801"];
                routeName = "A Line";
                railIcon.alt = "A Line";
                break;
              case "802":
                railIcon.src = LINE_ICONS["802"];
                routeName = "B Line";
                railIcon.alt = "B Line";
                break;
              case "803":
                railIcon.src = LINE_ICONS["803"];
                routeName = "C Line";
                railIcon.alt = "C Line";
                break;
              case "804":
                railIcon.src = LINE_ICONS["804"];
                routeName = "E Line";
                railIcon.alt = "D Line";
                break;
              case "805":
                railIcon.src = LINE_ICONS["805"];
                routeName = "D Line";
                railIcon.alt = "E Line";
                break;
              case "807":
                railIcon.src = LINE_ICONS["807"];
                routeName = "K Line";
                railIcon.alt = "K Line";
                break;
            }

            railIcon.setAttribute("width", "32");

            icon.appendChild(railIcon);

            break;
          case SERVICE.BUS:
            let busRoute = splitLine(item);
            let busIcon = document.createElement("img");

            switch (busRoute) {
              case "901":
                busIcon.src = LINE_ICONS["901"];
                busIcon.alt = "G Line";
                routeName = "G Line";
                icon.classList.add("alert-item__icon--bus-icon");
                icon.appendChild(busIcon);
                break;
              case "910":
                busIcon.src = LINE_ICONS["910"];
                busIcon.alt = "J Line";
                routeName = "J Line";
                icon.classList.add("alert-item__icon--bus-icon");
                icon.appendChild(busIcon);
                break;
              case "950":
                busIcon.src = LINE_ICONS["950"];
                busIcon.alt = "J Line";
                routeName = "J Line";
                icon.classList.add("alert-item__icon--bus-icon");
                icon.appendChild(busIcon);
                break;
              default:
                icon.classList.add("alert-item__icon--bus");
                routeName = `Line ${busRoute}`;
                icon.innerHTML = `<div>${item}</div>`;
            }

            break;
          case SERVICE.ACCESS:
            isAccessAlert = true;
            icon.classList.add("alert-item__icon--access");

            let accessIconDiv = document.createElement("div");
            let accessIcon = document.createElement("img");

            accessIcon.src = "img/elevator-white.svg";
            accessIcon.alt = "elevator icon";
            accessIcon.setAttribute("width", "32");

            accessIconDiv.appendChild(accessIcon);
            icon.appendChild(accessIconDiv);

            break;
        }

        // Create description content
        let content = document.createElement("div");
        content.classList.add("alert-item__content");

        let content_title = document.createElement("div");
        content_title.classList.add("alert-item__title");
        content_title.innerHTML = alert.headerText;

        let content_description = document.createElement("div");

        if (alert.descriptionText != "") {
          content_description.classList.add("alert-item__description");
          content_description.innerHTML =
            alert.descriptionText.replaceAll("\n", "<br>") + "<br><br>";
        }

        // Not a good idea if we default the URL to https://alerts.metro.net
        // if (alert.url) {
        //     content_description.innerHTML += `<a href="${alert.url}" target="_blank">More info on service impact to ${routeName}.</a><br><br>`;
        // }

        content_description.innerHTML +=
          "Starting on: " + formatDate(alert.activePeriods[0].start);
        if (alert.activePeriods[0].end) {
          content_description.innerHTML +=
            "<br>Ending on: " + formatDate(alert.activePeriods[0].end);
        } else {
          content_description.innerHTML += "<br>No end date scheduled yet.";
        }

        content.appendChild(content_title);
        content.appendChild(content_description);

        // Create status
        let status = document.createElement("div");
        status.classList.add("alert-item__status");

        let status_badge = document.createElement("div");

        if (isUpcoming(alert)) {
          status_badge.classList.add("alert-item__status--upcoming");
          status_badge.innerHTML = "Upcoming";
        } else {
          status_badge.classList.add("alert-item__status--current");
          status_badge.innerHTML = "Current";
        }

        status.appendChild(status_badge);

        // Add to page
        newAlert.appendChild(icon);
        newAlert.appendChild(content);
        newAlert.appendChild(status);

        alertList.appendChild(newAlert);

        if (isAccessAlert) {
          return false;
        } else {
          return true;
        }
      });
    }
  }
}
