"use strict";

function renderTemplate(options) {
    var template = options.template;
    var runtime = options.runtime;
    var css = options.css;
    var data = options.data || {};
    var title = data.title || "课程表";
    var meta = data.meta || {};
    var metaCourse = meta.courseCount != null ? String(meta.courseCount) : "-";
    var metaPeriod = meta.periodCount != null ? String(meta.periodCount) : "-";
    var metaExportedAt = meta.exportedAt || "-";

    var html = template;
    html = html.replace(/\{\{TITLE\}\}/g, title);
    html = html.replace(/\{\{META_COURSE\}\}/g, metaCourse);
    html = html.replace(/\{\{META_PERIOD\}\}/g, metaPeriod);
    html = html.replace(/\{\{META_EXPORTED_AT\}\}/g, metaExportedAt);
    html = html.replace("/*__THEME_CSS__*/", css);
    html = html.replace("/*__RUNTIME_JS__*/", runtime);
    html = html.replace("/*__DATA_JSON__*/", JSON.stringify(data));
    return html;
}

module.exports = renderTemplate;
