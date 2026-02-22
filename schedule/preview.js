(function () {
  "use strict";

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function loadJson(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null, JSON.parse(xhr.responseText));
      } else {
        callback(new Error("Failed to load " + url));
      }
    };
    xhr.send(null);
  }

  function loadText(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null, xhr.responseText);
      } else {
        callback(new Error("Failed to load " + url));
      }
    };
    xhr.send(null);
  }

  function renderWithData(data) {
    if (!data) {
      return;
    }
    document.title = data.title || "课程表";
    setText("titleText", data.title || "课程表");
    setText(
      "metaCourse",
      "课程数：" +
        (data.meta && data.meta.courseCount != null
          ? data.meta.courseCount
          : "-"),
    );
    setText(
      "metaPeriod",
      "节次：" +
        (data.meta && data.meta.periodCount != null
          ? data.meta.periodCount
          : "-"),
    );
    setText(
      "metaExportedAt",
      "导出时间：" +
        (data.meta && data.meta.exportedAt ? data.meta.exportedAt : "-"),
    );

    if (window.renderSchedule) {
      window.renderSchedule(data);
    }
  }

  loadText("/src/original/schedule.html", function (err, html) {
    if (err) {
      loadJson("/src/sspu/sample-data.json", function (jsonErr, data) {
        if (jsonErr) {
          console.error(jsonErr);
          return;
        }
        renderWithData(data);
      });
      return;
    }
    if (!window.SSPUParseOriginal) {
      console.error("SSPUParseOriginal not loaded.");
      return;
    }
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var data = window.SSPUParseOriginal(doc);
    if (!data) {
      console.error("Failed to parse original schedule.html");
      return;
    }
    renderWithData(data);
  });
})();
