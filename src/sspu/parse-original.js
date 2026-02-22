(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SSPUParseOriginal = factory();
  }
})(this, function () {
  "use strict";

  function safeText(value) {
    return value ? String(value).trim() : "";
  }

  function parseMetaNumber(text) {
    var match = safeText(text).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  function parseMetaValue(text) {
    var idx = safeText(text).indexOf("：");
    if (idx >= 0) {
      return safeText(text).slice(idx + 1);
    }
    idx = safeText(text).indexOf(":");
    if (idx >= 0) {
      return safeText(text).slice(idx + 1);
    }
    return safeText(text);
  }

  function parsePeriodText(text, fallbackIndex) {
    var clean = safeText(text);
    var match = clean.match(
      /第\s*(\d+)\s*节\s*([0-9]{2}:[0-9]{2})\s*[–-]\s*([0-9]{2}:[0-9]{2})/,
    );
    if (match) {
      return {
        p: parseInt(match[1], 10),
        start: match[2],
        end: match[3],
      };
    }
    return {
      p: fallbackIndex,
      start: "",
      end: "",
    };
  }

  function parseCourseMeta(text) {
    var meta = safeText(text);
    if (!meta) {
      return { teacher: "", room: "" };
    }
    var parts = meta.split(" · ");
    if (parts.length === 1) {
      return { teacher: parts[0], room: "" };
    }
    return { teacher: parts[0], room: parts.slice(1).join(" · ") };
  }

  function buildSessions(periodCourses, periodCount) {
    var sessions = [];
    var active = {};
    var p;
    for (p = 1; p <= periodCount; p++) {
      var present = {};
      var items = periodCourses[p] || [];
      var i;
      for (i = 0; i < items.length; i++) {
        var item = items[i];
        var key = [item.name, item.teacher, item.room, item.weeks].join("|");
        present[key] = true;
        if (active[key] && active[key].pTo === p - 1) {
          active[key].pTo = p;
        } else {
          active[key] = {
            pFrom: p,
            pTo: p,
            name: item.name,
            teacher: item.teacher,
            room: item.room,
            weeks: item.weeks,
          };
          sessions.push(active[key]);
        }
      }

      var keyList = Object.keys(active);
      for (i = 0; i < keyList.length; i++) {
        if (!present[keyList[i]]) {
          delete active[keyList[i]];
        }
      }
    }
    return sessions;
  }

  function getAttr(node, name) {
    return node && node.attrs ? node.attrs[name] : "";
  }

  function hasClass(node, className) {
    var cls = getAttr(node, "class") || "";
    return (" " + cls + " ").indexOf(" " + className + " ") >= 0;
  }

  function getText(node) {
    if (!node) {
      return "";
    }
    if (node.type === "text") {
      return node.text || "";
    }
    var out = "";
    var i;
    for (i = 0; i < node.children.length; i++) {
      out += getText(node.children[i]);
    }
    return out;
  }

  function getChildrenByTag(node, tag) {
    var list = [];
    var i;
    if (!node || !node.children) {
      return list;
    }
    for (i = 0; i < node.children.length; i++) {
      if (node.children[i].tag === tag) {
        list.push(node.children[i]);
      }
    }
    return list;
  }

  function findAll(node, predicate, list) {
    var i;
    if (!node) {
      return;
    }
    if (predicate(node)) {
      list.push(node);
    }
    if (!node.children) {
      return;
    }
    for (i = 0; i < node.children.length; i++) {
      findAll(node.children[i], predicate, list);
    }
  }

  function findFirst(node, predicate) {
    var list = [];
    findAll(node, predicate, list);
    return list.length ? list[0] : null;
  }

  function parseTag(token) {
    var content = token.replace(/^</, "").replace(/>$/, "");
    var selfClosing = false;
    if (content.charAt(content.length - 1) === "/") {
      selfClosing = true;
      content = content.slice(0, -1);
    }
    var parts = content.trim().split(/\s+/);
    var tag = parts.shift().toLowerCase();
    var attrs = {};
    var attrText = content.slice(tag.length).trim();
    if (attrText) {
      attrText.replace(
        /([a-zA-Z0-9-:]+)\s*=\s*"([^"]*)"/g,
        function (_, key, value) {
          attrs[key] = value;
          return "";
        },
      );
    }
    return { tag: tag, attrs: attrs, selfClosing: selfClosing };
  }

  function parseHtmlToTree(html) {
    var root = { tag: "root", attrs: {}, children: [] };
    var stack = [root];
    var tokens = html.match(/<[^>]+>|[^<]+/g) || [];
    var i;
    for (i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token) {
        continue;
      }
      if (token.indexOf("<!--") === 0) {
        continue;
      }
      if (token.indexOf("</") === 0) {
        stack.pop();
        continue;
      }
      if (token.indexOf("<") === 0) {
        var tagInfo = parseTag(token);
        var node = {
          tag: tagInfo.tag,
          attrs: tagInfo.attrs,
          children: [],
          type: "element",
        };
        stack[stack.length - 1].children.push(node);
        if (
          !tagInfo.selfClosing &&
          tagInfo.tag !== "meta" &&
          tagInfo.tag !== "link" &&
          tagInfo.tag !== "br"
        ) {
          stack.push(node);
        }
      } else {
        var text = token;
        if (text.trim()) {
          stack[stack.length - 1].children.push({ type: "text", text: text });
        }
      }
    }
    return root;
  }

  function parseOriginalDocument(doc) {
    var title =
      safeText(doc.title) ||
      safeText(
        doc.querySelector("h1") && doc.querySelector("h1").textContent,
      ) ||
      "课程表";
    var courseCountEl = doc.querySelector(".count-courses");
    var periodCountEl = doc.querySelector(".count-periods");
    var exportedAtEl = doc.querySelector(".exported-at");

    var meta = {
      courseCount: courseCountEl
        ? parseMetaNumber(courseCountEl.textContent)
        : null,
      periodCount: periodCountEl
        ? parseMetaNumber(periodCountEl.textContent)
        : null,
      exportedAt: exportedAtEl ? parseMetaValue(exportedAtEl.textContent) : "",
    };

    var table = doc.querySelector("table");
    if (!table) {
      return null;
    }

    var headLabels = [];
    var headCells = table.querySelectorAll("thead th");
    var keepIndices = [];
    var i;
    for (i = 1; i < headCells.length; i++) {
      var label = safeText(headCells[i].textContent);
      if (label === "周六" || label === "周日") {
        continue;
      }
      keepIndices.push(i - 1);
      headLabels.push(label);
    }

    var bodyRows = table.querySelectorAll("tbody tr");
    var periods = [];
    var dayCourses = [];
    for (i = 0; i < headLabels.length; i++) {
      dayCourses[i] = {};
    }

    for (i = 0; i < bodyRows.length; i++) {
      var row = bodyRows[i];
      var periodTh = row.querySelector("th.period");
      var period = parsePeriodText(periodTh ? periodTh.textContent : "", i + 1);
      periods.push(period);

      var cells = row.querySelectorAll("td");
      var dayIndex;
      for (dayIndex = 0; dayIndex < headLabels.length; dayIndex++) {
        var cell = cells[keepIndices[dayIndex]];
        if (!cell) {
          continue;
        }
        var courseEls = cell.querySelectorAll(".course");
        var list = [];
        var c;
        for (c = 0; c < courseEls.length; c++) {
          var nameEl = courseEls[c].querySelector(".course-name");
          var metaEl = courseEls[c].querySelector(".course-meta");
          var weeksEl = courseEls[c].querySelector(".week-range");
          var name = safeText(nameEl && nameEl.textContent) || "未命名课程";
          var metaParts = parseCourseMeta(metaEl && metaEl.textContent);
          var weeks = safeText(weeksEl && weeksEl.textContent);
          list.push({
            name: name,
            teacher: metaParts.teacher,
            room: metaParts.room,
            weeks: weeks,
          });
        }
        if (list.length) {
          dayCourses[dayIndex][period.p] = list;
        }
      }
    }

    var days = [];
    for (i = 0; i < headLabels.length; i++) {
      var sessions = buildSessions(dayCourses[i], periods.length);
      days.push({
        id:
          ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][i] ||
          "day" + (i + 1),
        label: headLabels[i],
        sessions: sessions,
      });
    }

    if (meta.periodCount == null) {
      meta.periodCount = periods.length;
    }

    if (meta.courseCount == null) {
      var unique = {};
      for (i = 0; i < days.length; i++) {
        var s = days[i].sessions;
        var j;
        for (j = 0; j < s.length; j++) {
          unique[s[j].name + "|" + s[j].teacher + "|" + s[j].room] = true;
        }
      }
      meta.courseCount = Object.keys(unique).length;
    }

    return {
      title: title,
      meta: meta,
      periods: periods,
      days: days,
    };
  }

  function parseOriginalTree(root) {
    var titleNode = findFirst(root, function (node) {
      return node.tag === "title";
    });
    var title = safeText(getText(titleNode)) || "课程表";

    var courseCountEl = findFirst(root, function (node) {
      return node.tag === "span" && hasClass(node, "count-courses");
    });
    var periodCountEl = findFirst(root, function (node) {
      return node.tag === "span" && hasClass(node, "count-periods");
    });
    var exportedAtEl = findFirst(root, function (node) {
      return node.tag === "span" && hasClass(node, "exported-at");
    });

    var meta = {
      courseCount: courseCountEl
        ? parseMetaNumber(getText(courseCountEl))
        : null,
      periodCount: periodCountEl
        ? parseMetaNumber(getText(periodCountEl))
        : null,
      exportedAt: exportedAtEl ? parseMetaValue(getText(exportedAtEl)) : "",
    };

    var table = findFirst(root, function (node) {
      return node.tag === "table";
    });
    if (!table) {
      return null;
    }

    var thead = findFirst(table, function (node) {
      return node.tag === "thead";
    });
    var headLabels = [];
    var keepIndices = [];
    if (thead) {
      var headThs = [];
      findAll(
        thead,
        function (node) {
          return node.tag === "th";
        },
        headThs,
      );
      var i;
      for (i = 1; i < headThs.length; i++) {
        var label = safeText(getText(headThs[i]));
        if (label === "周六" || label === "周日") {
          continue;
        }
        keepIndices.push(i - 1);
        headLabels.push(label);
      }
    }

    var tbody = findFirst(table, function (node) {
      return node.tag === "tbody";
    });
    if (!tbody) {
      return null;
    }

    var rows = getChildrenByTag(tbody, "tr");
    var periods = [];
    var dayCourses = [];
    var i;
    for (i = 0; i < headLabels.length; i++) {
      dayCourses[i] = {};
    }

    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      var ths = getChildrenByTag(row, "th");
      var periodTh = null;
      var thIndex;
      for (thIndex = 0; thIndex < ths.length; thIndex++) {
        if (hasClass(ths[thIndex], "period")) {
          periodTh = ths[thIndex];
          break;
        }
      }
      var period = parsePeriodText(periodTh ? getText(periodTh) : "", i + 1);
      periods.push(period);

      var tds = getChildrenByTag(row, "td");
      var dayIndex;
      for (dayIndex = 0; dayIndex < headLabels.length; dayIndex++) {
        var cell = tds[keepIndices[dayIndex]];
        if (!cell) {
          continue;
        }
        var courseNodes = [];
        findAll(
          cell,
          function (node) {
            return node.tag === "div" && hasClass(node, "course");
          },
          courseNodes,
        );

        var list = [];
        var c;
        for (c = 0; c < courseNodes.length; c++) {
          var nameNode = findFirst(courseNodes[c], function (node) {
            return node.tag === "div" && hasClass(node, "course-name");
          });
          var metaNode = findFirst(courseNodes[c], function (node) {
            return node.tag === "div" && hasClass(node, "course-meta");
          });
          var weeksNode = findFirst(courseNodes[c], function (node) {
            return node.tag === "div" && hasClass(node, "week-range");
          });
          var name = safeText(getText(nameNode)) || "未命名课程";
          var metaParts = parseCourseMeta(getText(metaNode));
          var weeks = safeText(getText(weeksNode));
          list.push({
            name: name,
            teacher: metaParts.teacher,
            room: metaParts.room,
            weeks: weeks,
          });
        }

        if (list.length) {
          dayCourses[dayIndex][period.p] = list;
        }
      }
    }

    var days = [];
    for (i = 0; i < headLabels.length; i++) {
      var sessions = buildSessions(dayCourses[i], periods.length);
      days.push({
        id:
          ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][i] ||
          "day" + (i + 1),
        label: headLabels[i],
        sessions: sessions,
      });
    }

    if (meta.periodCount == null) {
      meta.periodCount = periods.length;
    }

    if (meta.courseCount == null) {
      var unique = {};
      for (i = 0; i < days.length; i++) {
        var s = days[i].sessions;
        var j;
        for (j = 0; j < s.length; j++) {
          unique[s[j].name + "|" + s[j].teacher + "|" + s[j].room] = true;
        }
      }
      meta.courseCount = Object.keys(unique).length;
    }

    return {
      title: title,
      meta: meta,
      periods: periods,
      days: days,
    };
  }

  function parseOriginal(input) {
    if (!input) {
      return null;
    }
    if (typeof input === "string") {
      var tree = parseHtmlToTree(input);
      return parseOriginalTree(tree);
    }
    if (input.querySelector) {
      return parseOriginalDocument(input);
    }
    return null;
  }

  return parseOriginal;
});
