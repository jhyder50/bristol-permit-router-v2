(() => {
  "use strict";

  // When the permit router is embedded inside ArcGIS Experience Builder,
  // do not pass the deprecated Survey123 clientId. The Main Intake survey
  // is public, and Survey123 only requires a credential/token for private surveys.
  // Direct/top-level use of the router keeps the existing clientId behavior.
  if (window.self === window.top) return;
  if (!window.Survey123WebForm) return;

  const NativeSurvey123WebForm = window.Survey123WebForm;

  function EmbeddedSurvey123WebForm(options = {}) {
    const embeddedOptions = { ...options };
    delete embeddedOptions.clientId;
    return new NativeSurvey123WebForm(embeddedOptions);
  }

  EmbeddedSurvey123WebForm.prototype = NativeSurvey123WebForm.prototype;
  Object.setPrototypeOf(EmbeddedSurvey123WebForm, NativeSurvey123WebForm);
  window.Survey123WebForm = EmbeddedSurvey123WebForm;

  console.log("Bristol permit router: embedded Experience Builder mode enabled; Survey123 clientId omitted.");
})();
