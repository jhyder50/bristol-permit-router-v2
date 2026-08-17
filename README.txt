CITY OF BRISTOL - MAIN INTAKE CONDITIONAL ROUTER
================================================

PURPOSE
The page embeds Main Application Intake for Permits. It remembers the value of
'dep_permit_type'. After Survey123 confirms a successful submission, the page
immediately opens the corresponding application and prefills the intake fields.
The normal Survey123 thank-you screen is not shown.

ROUTES CURRENTLY CONFIGURED
building     -> Building Application (d671537051ae480f9405d96330afa833)
commDevPlan  -> Community Development and Planning Permit Application (07f89565c10344c9ac19bb18adbf2c5e)
engineering  -> Engineering Permit Application (550929ceaaa1448fa05f838770f1dea7)
rentProp     -> Rental Property Notification (c29cd2ec861d42b0b09ba650326caa9f)
sEvents      -> Special Event - Park Rental Application (7a1237d8117c4676987e72a2bc15f20e)

DEPLOYMENT
1. Upload index.html, config.js, router.js, and styles.css together to any HTTPS
   web server. Do not open index.html directly from a local file path.
2. Open the hosted index.html URL and submit one test for each department.
3. Replace the public Main Intake link with the hosted router URL.
4. In the Main Intake survey's Survey123 website settings, disable its own
   Action after submission redirect. The wrapper handles navigation.

IMPORTANT
- All five destination surveys must be shared with the same audience as Main Intake.
- If a replacement survey is published under a new item ID, edit only config.js.
- The wrapper passes the submitted GlobalID, handoff ID, project/applicant fields,
  and project number when available.
- Survey123's direct share URL cannot perform this conditional redirect by itself.

TESTING
Add ?test=1 to the hosted URL only for your own browser testing if you later add
custom diagnostics. The production code currently performs real submissions.

DEPLOYMENT REFRESH
2026-08-17 14:29 ET - documentation-only commit used to trigger a fresh GitHub Pages deployment after a transient Pages service failure.
