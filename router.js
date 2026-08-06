(() => {
  "use strict";

  const config = window.BRISTOL_ROUTER_CONFIG;
  const statusEl = document.getElementById("router-status");
  const formEl = document.getElementById("formDiv");
  const answers = Object.create(null);
  const VALID_ROUTES = new Set([
    "building",
    "commDevPlan",
    "engineering",
    "rentProp",
    "sEvents"
  ]);

  let selectedRoute = "";
  let submitted = false;
  let webform = null;

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function normalizeScalar(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value) && value.length === 1) return normalizeScalar(value[0]);
    if (typeof value === "object") {
      if ("value" in value) return normalizeScalar(value.value);
      if ("name" in value && Object.keys(value).length <= 3) return normalizeScalar(value.name);
    }
    return value;
  }

  function validRoute(value) {
    const route = normalizeScalar(value);
    return VALID_ROUTES.has(route) ? route : "";
  }

  function rememberRoute(value) {
    const route = validRoute(value);
    if (!route) return "";
    selectedRoute = route;
    answers.dep_permit_type = route;
    sessionStorage.setItem("bristolPermitRoute", route);
    return route;
  }

  function extractFieldName(data) {
    return (
      data?.field ??
      data?.fieldName ??
      data?.name ??
      data?.questionName ??
      data?.question?.fieldName ??
      data?.question?.name ??
      data?.detail?.field ??
      data?.detail?.fieldName ??
      data?.detail?.name ??
      ""
    );
  }

  function extractFieldValue(data) {
    if (data && Object.prototype.hasOwnProperty.call(data, "value")) return data.value;
    if (data?.detail && Object.prototype.hasOwnProperty.call(data.detail, "value")) return data.detail.value;
    if (data?.question && Object.prototype.hasOwnProperty.call(data.question, "value")) return data.question.value;
    return "";
  }

  function handleQuestionChanged(data) {
    const field = extractFieldName(data);
    if (!field) return;

    const value = normalizeScalar(extractFieldValue(data));
    answers[field] = value;

    if (field === "dep_permit_type") {
      const route = rememberRoute(value);
      console.log("Bristol router department selected:", route || value, data);
    }
  }

  function mergeAttributes(source) {
    if (!source || typeof source !== "object") return;

    const allowedFields = new Set([
      "GlobalID", "globalid", "globalId",
      "handoff_id", "prjNumber", "dep_permit_type",
      "project", "description", "propstartdt", "propenddt",
      "appname", "appcompany", "appaddr", "appcity", "appstate",
      "appzip", "appphone", "appemail", "license",
      "permpaid", "status"
    ]);

    const candidates = [
      source,
      source.values,
      source.attributes,
      source.questionValue,
      source.data,
      source.detail,
      source.feature?.attributes,
      source.features?.[0]?.attributes,
      source.surveyFeatureSet?.features?.[0]?.attributes,
      source.featureSet?.features?.[0]?.attributes
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

      for (const [key, value] of Object.entries(candidate)) {
        if (!allowedFields.has(key)) continue;

        const normalized = normalizeScalar(value);

        if (
          ["appname", "appcompany", "license"].includes(key) &&
          /^https?:\/\//i.test(String(normalized || ""))
        ) {
          continue;
        }

        if (normalized === "" && answers[key] !== undefined && answers[key] !== "") {
          continue;
        }

        answers[key] = normalized;
      }
    }

    const seen = new WeakSet();
    function findDepartment(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 6 || seen.has(node)) return "";
      seen.add(node);

      if (Object.prototype.hasOwnProperty.call(node, "dep_permit_type")) {
        const found = validRoute(node.dep_permit_type);
        if (found) return found;
      }

      const field = extractFieldName(node);
      if (field === "dep_permit_type") {
        const found = validRoute(extractFieldValue(node));
        if (found) return found;
      }

      for (const value of Object.values(node)) {
        const found = findDepartment(value, depth + 1);
        if (found) return found;
      }
      return "";
    }

    const foundRoute =
      validRoute(answers.dep_permit_type) ||
      findDepartment(source);

    if (foundRoute) rememberRoute(foundRoute);
  }

  function extractSubmittedAttributes(data) {
    return (
      data?.surveyFeatureSet?.features?.[0]?.attributes ||
      data?.featureSet?.features?.[0]?.attributes ||
      data?.features?.[0]?.attributes ||
      data?.feature?.attributes ||
      data?.attributes ||
      {}
    );
  }

  function stripBraces(value) {
    return String(value || "").replace(/^\{/, "").replace(/\}$/, "");
  }

  function formatDate(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    const text = String(value);
    const dateMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
    return dateMatch ? dateMatch[0] : text;
  }

  function addField(params, fieldName, value) {
    if (value === null || value === undefined || value === "") return;
    params.set(`field:${fieldName}`, String(value));
  }

  function buildDestination(routeKey) {
    if (!VALID_ROUTES.has(routeKey)) {
      throw new Error(
        "The selected department was not captured. The router stopped instead of opening the wrong application."
      );
    }

    const route = config.routes[routeKey];
    if (!String(answers.prjNumber || "").trim()) {
      throw new Error("The project number is not available yet. The selected application was not opened.");
    }
    if (!route?.itemId) {
      throw new Error(`No destination is configured for department value "${routeKey}".`);
    }

    const params = new URLSearchParams();
    params.set("hide", "description,footer");
    params.set("width", "1");

    const globalId = stripBraces(
      answers.globalid || answers.globalId || answers.GlobalID || answers.GLOBALID || ""
    );

    addField(params, "incoming_prj", answers.prjNumber);
    addField(params, "incoming_parentglobalid", globalId);
    addField(params, "incoming_handoff_id", stripBraces(answers.handoff_id));
    addField(params, "incoming_project", answers.project);
    addField(params, "incoming_description", answers.description);
    addField(params, "incoming_propstartdt", formatDate(answers.propstartdt));
    addField(params, "incoming_propenddt", formatDate(answers.propenddt));
    addField(params, "incoming_appname", answers.appname);
    addField(params, "incoming_appcompany", answers.appcompany);
    addField(params, "incoming_appaddr", answers.appaddr);
    addField(params, "incoming_appcity", answers.appcity);
    addField(params, "incoming_appstate", answers.appstate);
    addField(params, "incoming_appzip", answers.appzip);
    addField(params, "incoming_appphone", answers.appphone);
    addField(params, "incoming_appemail", answers.appemail);
    addField(params, "incoming_license", answers.license);
    addField(params, "incoming_permpaid", answers.permpaid);
    addField(params, "incoming_status", answers.status);
    addField(params, "dep_permit_type", routeKey);

    return `${config.surveyBaseUrl}${route.itemId}?${params.toString()}`;
  }

  async function readCurrentFormValues() {
    if (!webform || typeof webform.getQuestionValue !== "function") return;
    try {
      const current = await webform.getQuestionValue();
      console.log("Bristol router current form values:", current);
      mergeAttributes(current);
    } catch (error) {
      console.warn("Could not reread Survey123 values:", error);
    }
  }

  function findFeatureServiceUrl(source) {
    if (!source || typeof source !== "object") return "";
    const seen = new WeakSet();

    function walk(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 8 || seen.has(node)) return "";
      seen.add(node);

      for (const [key, value] of Object.entries(node)) {
        if (typeof value === "string") {
          const match = value.match(/https:\/\/[^"'?\s]+\/FeatureServer\/\d+/i);
          if (match) return match[0];
          if (/url|layer|service/i.test(key) && /FeatureServer\/\d+/i.test(value)) {
            return value.split("?")[0];
          }
        } else if (value && typeof value === "object") {
          const found = walk(value, depth + 1);
          if (found) return found;
        }
      }
      return "";
    }

    return walk(source);
  }

  function normalizeGuid(value) {
    return String(value || "").trim().replace(/^\{/, "").replace(/\}$/, "");
  }

  async function queryProjectNumber(lookupLayerUrl, handoffId) {
    const cleanHandoffId = String(handoffId || "").trim();
    if (!lookupLayerUrl || !cleanHandoffId) return "";

    const params = new URLSearchParams({
      f: "json",
      where: `handoff_id='${cleanHandoffId.replace(/'/g, "''")}'`,
      outFields: "prjNumber,handoff_id",
      returnGeometry: "false",
      resultRecordCount: "1",
      orderByFields: "OBJECTID DESC",
      cacheHint: "false"
    });

    const response = await fetch(`${lookupLayerUrl}/query?${params.toString()}`, {
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Project-number lookup failed with HTTP ${response.status}.`);
    }

    const result = await response.json();
    console.log("Project lookup result:", result);

    if (result?.error) {
      throw new Error(result.error.message || "Project-number lookup failed.");
    }

    return String(
      result?.features?.[0]?.attributes?.prjNumber || ""
    ).trim();
  }

  async function waitForProjectNumber(data) {
    const submittedAttributes = extractSubmittedAttributes(data);

    const handoffId = String(
      submittedAttributes?.handoff_id ||
      answers.handoff_id ||
      ""
    ).trim();

    const lookupLayerUrl = config.projectLookupLayerUrl;

    if (!handoffId) {
      throw new Error(
        "The intake was submitted, but its handoff ID was not returned."
      );
    }

    if (!lookupLayerUrl) {
      throw new Error(
        "The intake was submitted, but the project lookup layer URL was unavailable."
      );
    }

    for (let attempt = 1; attempt <= 35; attempt += 1) {
      setStatus(
        attempt === 1
          ? "Creating project number…"
          : `Creating project number… ${attempt} seconds`
      );

      try {
        const projectNumber = await queryProjectNumber(
          lookupLayerUrl,
          handoffId
        );

        if (projectNumber) {
          answers.prjNumber = projectNumber;
          return projectNumber;
        }
      } catch (error) {
        console.warn("Project-number lookup attempt failed:", error);
      }

      if (attempt < 35) {
        await new Promise(resolve => window.setTimeout(resolve, 1000));
      }
    }

    throw new Error(
      "The intake was submitted, but the project number was not found within 35 seconds."
    );
  }

  async function routeAfterSubmission(data) {
    if (submitted) return;
    submitted = true;

    console.log("Bristol router submitted payload:", data);
    mergeAttributes(extractSubmittedAttributes(data));
    mergeAttributes(data);
    await readCurrentFormValues();

    const routeKey =
      validRoute(answers.dep_permit_type) ||
      validRoute(selectedRoute) ||
      validRoute(sessionStorage.getItem("bristolPermitRoute"));

    try {
      if (!routeKey) {
        throw new Error("Submission succeeded, but the department value was not available to the router.");
      }

      formEl.classList.add("hidden");
      await waitForProjectNumber(data);

      const destination = buildDestination(routeKey);
      const label = config.routes[routeKey].label;
      setStatus(`Opening ${label}…`);
      sessionStorage.removeItem("bristolPermitRoute");
      window.location.replace(destination);
    } catch (error) {
      submitted = false;
      formEl.classList.remove("hidden");
      setStatus(error.message, true);
      console.error("Bristol routing stopped:", error, {
        selectedRoute,
        answers,
        submittedData: data
      });
    }
  }

  function resizeEmbeddedForm(data) {
    const reportedHeight = Number(
      data?.contentHeight ??
      data?.height ??
      data?.formHeight ??
      0
    );

    const iframe = formEl.querySelector("iframe");
    const height = reportedHeight > 0
      ? Math.max(900, Math.ceil(reportedHeight) + 40)
      : Math.max(900, window.innerHeight);

    formEl.style.height = `${height}px`;
    formEl.style.minHeight = `${height}px`;

    if (iframe) {
      iframe.style.width = "100%";
      iframe.style.height = `${height}px`;
      iframe.setAttribute("height", String(height));
      iframe.setAttribute(
        "allow",
        "geolocation https://survey123.arcgis.com; camera https://survey123.arcgis.com"
      );
    }
  }

  function initialize() {
    if (!window.Survey123WebForm) {
      setStatus("The Survey123 form library did not load. Refresh the page and try again.", true);
      return;
    }

    sessionStorage.removeItem("bristolPermitRoute");
    setStatus("Loading permit application…");

    webform = new Survey123WebForm({
      container: "formDiv",
      clientId: "qo3W5ymZkpyWwyOT",
      itemId: config.mainSurveyItemId,
      portalUrl: config.portalUrl,
      width: 1,
      hideElements: ["navbar", "footer"],
      onFormLoaded: (data) => {
        setStatus("");
        resizeEmbeddedForm(data);
        window.setTimeout(() => resizeEmbeddedForm(data), 250);
      },
      onFormResized: resizeEmbeddedForm,
      onQuestionValueChanged: handleQuestionChanged,
      onFormSubmit: async () => {
        await readCurrentFormValues();
        const route = validRoute(answers.dep_permit_type) || validRoute(selectedRoute);
        setStatus(route ? `Submitting ${config.routes[route].label} intake…` : "Submitting application…");
      },
      onFormSubmitted: routeAfterSubmission,
      onFormFailed: (data) => {
        console.error("Survey123 form failed:", data);
        const detail = data?.message || data?.error?.message || "";
        setStatus(
          detail
            ? `The Survey123 form failed: ${detail}`
            : "The Survey123 form failed to load or submit.",
          true
        );
      }
    });

    if (typeof webform.setOnQuestionValueChanged === "function") {
      webform.setOnQuestionValueChanged(handleQuestionChanged);
    }
    if (typeof webform.setOnFormSubmit === "function") {
      webform.setOnFormSubmit(async () => {
        await readCurrentFormValues();
        const route = validRoute(answers.dep_permit_type) || validRoute(selectedRoute);
        setStatus(route ? `Submitting ${config.routes[route].label} intake…` : "Submitting application…");
      });
    }
    if (typeof webform.setOnFormSubmitted === "function") {
      webform.setOnFormSubmitted(routeAfterSubmission);
    }
    if (typeof webform.on === "function") {
      webform.on("questionValueChanged", handleQuestionChanged);
      webform.on("formSubmitted", routeAfterSubmission);
    }

    window.bristolMainIntakeWebForm = webform;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
