(function () {
  "use strict";

  // 用户自定义：第 1 周周一日期（北京时间），格式 YYYY-MM-DD
  var WEEK1_START = "2026-03-02";
  // 用户自定义：期末周（最后一周）周次
  var TERM_FINAL_WEEK = 17;
  // debug：假设今天日期（北京时间），格式 YYYY-MM-DD；留空表示使用当前日期
  var DEBUG_TODAY = "";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findPeriod(periods, p) {
    var i;
    for (i = 0; i < periods.length; i++) {
      if (periods[i].p === p) {
        return periods[i];
      }
    }
    return null;
  }

  function timeRange(periods, pFrom, pTo) {
    var a = findPeriod(periods, pFrom);
    var b = findPeriod(periods, pTo);
    if (!a || !b) {
      return "";
    }
    return a.start + "–" + b.end + "（第" + pFrom + "–" + pTo + "节）";
  }

  function parseWeekRangesText(text) {
    var ranges = [];
    if (!text) {
      return ranges;
    }
    var re = /(\d+)(?:\s*-\s*(\d+))?/g;
    var match;
    while ((match = re.exec(text))) {
      var start = parseInt(match[1], 10);
      var end = match[2] ? parseInt(match[2], 10) : start;
      ranges.push([start, end]);
    }
    return ranges;
  }

  function isWeekInRanges(week, ranges) {
    if (!ranges || !ranges.length) {
      return true;
    }
    var i;
    for (i = 0; i < ranges.length; i++) {
      if (week >= ranges[i][0] && week <= ranges[i][1]) {
        return true;
      }
    }
    return false;
  }

  function parseDateText(text) {
    if (!text) {
      return null;
    }
    var parts = text.split("-");
    if (parts.length !== 3) {
      return null;
    }
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
  }

  function getBeijingDate() {
    try {
      if (DEBUG_TODAY) {
        var mock = parseDateText(DEBUG_TODAY);
        if (mock) {
          return mock;
        }
      }
      return new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
      );
    } catch (error) {
      return new Date();
    }
  }

  function getWeekNumber(startDateText) {
    if (!startDateText) {
      return null;
    }
    var start = parseDateText(startDateText);
    if (!start) {
      return null;
    }
    var now = getBeijingDate();
    var diff = now.getTime() - start.getTime();
    var dayMs = 24 * 60 * 60 * 1000;
    var days = Math.floor(diff / dayMs);
    if (days < 0) {
      return null;
    }
    return Math.floor(days / 7) + 1;
  }

  function filterDaysByWeek(days, week) {
    if (!week || (TERM_FINAL_WEEK && week > TERM_FINAL_WEEK)) {
      var blank = [];
      var b;
      for (b = 0; b < days.length; b++) {
        blank.push({
          id: days[b].id,
          label: days[b].label,
          sessions: [],
        });
      }
      return blank;
    }
    var out = [];
    var i;
    for (i = 0; i < days.length; i++) {
      var d = days[i];
      var sessions = [];
      var s;
      for (s = 0; s < d.sessions.length; s++) {
        var ranges = parseWeekRangesText(d.sessions[s].weeks);
        if (isWeekInRanges(week, ranges)) {
          sessions.push(d.sessions[s]);
        }
      }
      out.push({
        id: d.id,
        label: d.label,
        sessions: sessions,
      });
    }
    return out;
  }

  function getWeekLabel(week) {
    if (!week) {
      return "未开学";
    }
    if (TERM_FINAL_WEEK && week > TERM_FINAL_WEEK) {
      return "已结课";
    }
    return "第" + week + "周";
  }

  function renderList(root, data) {
    var dIndex;
    var week = getWeekNumber(WEEK1_START);
    var days = filterDaysByWeek(data.days, week);
    var weekLabel = getWeekLabel(week);
    root.innerHTML = "";
    for (dIndex = 0; dIndex < days.length; dIndex++) {
      var d = days[dIndex];
      var wrap = document.createElement("section");
      var h2 = document.createElement("h2");
      wrap.className = "day";
      h2.textContent = weekLabel + " " + d.label;
      wrap.appendChild(h2);

      if (!d.sessions || !d.sessions.length) {
        var p = document.createElement("p");
        p.className = "empty";
        p.textContent = "无课程";
        wrap.appendChild(p);
      } else {
        var sIndex;
        for (sIndex = 0; sIndex < d.sessions.length; sIndex++) {
          var s = d.sessions[sIndex];
          var div = document.createElement("div");
          div.className = "session";
          div.innerHTML =
            '<p class="time">' +
            escapeHtml(timeRange(data.periods, s.pFrom, s.pTo)) +
            "</p>" +
            '<p class="name">' +
            escapeHtml(s.name) +
            "</p>" +
            '<p class="detail">' +
            escapeHtml(s.teacher) +
            " · " +
            escapeHtml(s.room) +
            "</p>" +
            '<p class="detail">周次：' +
            escapeHtml(s.weeks) +
            "</p>";
          wrap.appendChild(div);
        }
      }
      root.appendChild(wrap);
    }
  }

  function renderTable(headRow, body, data) {
    var dIndex;
    var pIndex;
    var periods = data.periods;
    var week = getWeekNumber(WEEK1_START);
    var weekLabel = getWeekLabel(week);
    var days = data.days;
    var todayIndex = null;
    var now = getBeijingDate();
    var weekday = now.getDay(); // 0=Sun
    if (weekday >= 1 && weekday <= 5) {
      todayIndex = weekday - 1;
    }
    var dayMap = [];
    var covered = [];

    headRow.innerHTML = "";
    var emptyTh = document.createElement("th");
    emptyTh.className = "week-label";
    emptyTh.textContent = weekLabel;
    headRow.appendChild(emptyTh);
    for (dIndex = 0; dIndex < days.length; dIndex++) {
      var dayTh = document.createElement("th");
      dayTh.textContent = days[dIndex].label;
      if (todayIndex !== null && dIndex === todayIndex) {
        dayTh.className = "today";
      }
      headRow.appendChild(dayTh);
    }

    for (dIndex = 0; dIndex < days.length; dIndex++) {
      var m = {};
      var c = {};
      var sessions = days[dIndex].sessions || [];
      var sIndex;
      for (sIndex = 0; sIndex < sessions.length; sIndex++) {
        var s = sessions[sIndex];
        var p;
        for (p = s.pFrom; p <= s.pTo; p++) {
          m[p] = s;
        }
      }
      dayMap[dIndex] = m;
      covered[dIndex] = c;
    }

    body.innerHTML = "";
    for (pIndex = 0; pIndex < periods.length; pIndex++) {
      var per = periods[pIndex];
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.className = "period";
      th.textContent = "第" + per.p + "节 " + per.start + "–" + per.end;
      tr.appendChild(th);

      for (dIndex = 0; dIndex < days.length; dIndex++) {
        if (covered[dIndex][per.p]) {
          continue;
        }

        var td = document.createElement("td");
        if (todayIndex !== null && dIndex === todayIndex) {
          td.className = "today";
        }
        var session = dayMap[dIndex][per.p];
        if (!session) {
          tr.appendChild(td);
          continue;
        }

        if (per.p !== session.pFrom) {
          tr.appendChild(td);
          continue;
        }

        var rowspan = session.pTo - session.pFrom + 1;
        td.setAttribute("rowspan", String(rowspan));
        td.innerHTML =
          '<div class="cell">' +
          '<p class="name">' +
          escapeHtml(session.name) +
          "</p>" +
          '<p class="detail">' +
          escapeHtml(session.teacher) +
          " · " +
          escapeHtml(session.room) +
          "</p>" +
          '<p class="weeks">周次：' +
          escapeHtml(session.weeks) +
          "</p>" +
          '<p class="detail">' +
          escapeHtml(per.start) +
          "–" +
          escapeHtml(findPeriod(periods, session.pTo).end) +
          "</p>" +
          "</div>";
        tr.appendChild(td);

        var mark;
        for (mark = session.pFrom + 1; mark <= session.pTo; mark++) {
          covered[dIndex][mark] = true;
        }
      }

      body.appendChild(tr);
    }
  }

  function renderSchedule(data) {
    if (!data || !data.days || !data.periods) {
      return;
    }

    var week = getWeekNumber(WEEK1_START);
    var metaWeek = document.getElementById("metaWeek");
    var weekLabel = getWeekLabel(week);
    if (metaWeek) {
      metaWeek.textContent = "教学周：" + weekLabel;
    }
    var listRoot = document.getElementById("listView");
    var headRow = document.getElementById("tableHead");
    var bodyRoot = document.getElementById("tableBody");
    if (listRoot) {
      renderList(listRoot, data);
      var todayIndex = null;
      var now = getBeijingDate();
      var weekday = now.getDay();
      if (weekday >= 1 && weekday <= 5) {
        todayIndex = weekday - 1;
      }
      if (todayIndex !== null) {
        var days = listRoot.querySelectorAll(".day");
        if (days[todayIndex] && days[todayIndex].scrollIntoView) {
          var tries = 0;
          var maxTries = 3;
          var smoothScrollTo = function (targetY, duration) {
            var startY =
              window.pageYOffset ||
              document.documentElement.scrollTop ||
              document.body.scrollTop ||
              0;
            var diff = targetY - startY;
            if (diff === 0) {
              return;
            }
            var start = Date.now();
            var easeOutCubic = function (t) {
              var p = t - 1;
              return p * p * p + 1;
            };
            var tick = function () {
              var now = Date.now();
              var elapsed = now - start;
              var t = Math.min(1, elapsed / duration);
              var eased = easeOutCubic(t);
              var y = startY + diff * eased;
              window.scrollTo(0, Math.round(y));
              if (t < 1) {
                if (window.requestAnimationFrame) {
                  window.requestAnimationFrame(tick);
                } else {
                  setTimeout(tick, 16);
                }
              }
            };
            tick();
          };
          var doScroll = function () {
            tries += 1;
            days[todayIndex].className += " today";
            var rect = days[todayIndex].getBoundingClientRect();
            var top =
              rect.top +
              (window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0) -
              8;
            smoothScrollTo(top, 650);
            if (tries < maxTries) {
              setTimeout(function () {
                var newRect = days[todayIndex].getBoundingClientRect();
                if (Math.abs(newRect.top - 8) > 12) {
                  doScroll();
                }
              }, 180);
            }
          };
          setTimeout(function () {
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(function () {
                doScroll();
              });
            } else {
              doScroll();
            }
          }, 120);
        }
      }
    }
    if (headRow && bodyRoot) {
      renderTable(headRow, bodyRoot, data);
    }
  }

  window.renderSchedule = renderSchedule;
})();
