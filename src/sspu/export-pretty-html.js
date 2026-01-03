// Run this in the browser console on the timetable page to download
// a pretty, standalone HTML preview of the schedule.
(function () {
    "use strict";

    if (typeof window === "undefined" || typeof document === "undefined") {
        return;
    }

    var DEBUG_SCHEDULE = true;
    var DEBUG_ANCHOR = "互联网思维与创新(0506)";

    function safeText(value) {
        return value ? String(value) : "";
    }

    function sanitizeFilename(name) {
        var cleaned = safeText(name).trim();
        if (!cleaned) {
            return "课程表";
        }
        return cleaned.replace(/[\\/:*?"<>|]/g, "_");
    }

    function downloadHtml(content, filename) {
        var blob = new Blob([content], { type: "text/html;charset=utf-8" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        setTimeout(function () {
            URL.revokeObjectURL(link.href);
            link.remove();
        }, 0);
    }

    function findGradTable() {
        try {
            if (window.$ && $("#frmright")[0]) {
                var target = $($("#frmright")[0].contentDocument).find(
                    "#div-table tbody",
                )[0];
                return target || null;
            }
        } catch (error) {
            console.error(error);
        }
        return null;
    }

    function findEamsTable() {
        try {
            if (window.table0) {
                return window.table0;
            }
        } catch (error) {
            console.error(error);
        }
        try {
            if (window.hasOwnProperty("table0")) {
                return window.table0;
            }
        } catch (error) {
            console.error(error);
        }
        var ifrs = document.querySelectorAll("iframe");
        for (var i = 0; i < ifrs.length; i++) {
            try {
                if (ifrs[i].contentWindow && ifrs[i].contentWindow.table0) {
                    return ifrs[i].contentWindow.table0;
                }
            } catch (error) {
                console.error(error);
            }
        }
        return null;
    }

    function getSemester(mode) {
        try {
            if (mode === "eams") {
                var input = document.querySelector(
                    "#courseTableForm input.calendar-text",
                );
                return input ? input.value : "";
            }
            if (mode === "grad") {
                if (window.$ && $("#frmright")[0]) {
                    return $(
                        $($("#frmright")[0].contentDocument).find(
                            "#div-table div",
                        )[0],
                    ).html();
                }
            }
        } catch (error) {
            console.error(error);
        }
        return "";
    }

    function parseWeekRanges(validWeeks) {
        var bits = safeText(validWeeks);
        if (!bits) {
            return "";
        }
        var ranges = [];
        var start = null;
        for (var i = 1; i < bits.length; i++) {
            if (bits[i] === "1") {
                if (start === null) {
                    start = i;
                }
            } else if (start !== null) {
                ranges.push([start, i - 1]);
                start = null;
            }
        }
        if (start !== null) {
            ranges.push([start, bits.length - 1]);
        }
        if (!ranges.length) {
            return "";
        }
        var parts = ranges.map(function (range) {
            return range[0] === range[1]
                ? range[0] + "周"
                : range[0] + "-" + range[1] + "周";
        });
        return parts.join(", ");
    }

    function normalizeActivities(rawdata) {
        var activities = rawdata && rawdata.activities;
        if (!activities || !activities.length) {
            return null;
        }
        var unitCount = rawdata.unitCount;
        if (!unitCount) {
            unitCount = rawdata.unitCounts
                ? Math.round(rawdata.unitCounts / 7)
                : Math.round(activities.length / 7);
        }
        var dayCount = rawdata.endAtSat ? 6 : 7;
        if (unitCount) {
            var inferredDays = Math.round(activities.length / unitCount);
            if (inferredDays >= 5 && inferredDays <= 7) {
                dayCount = inferredDays;
            }
        }
        if (DEBUG_SCHEDULE) {
            console.log("[pretty] unitCount:", unitCount);
            console.log("[pretty] unitCounts:", rawdata.unitCounts);
            console.log("[pretty] activities.length:", activities.length);
            console.log("[pretty] inferredDays:", inferredDays);
            console.log("[pretty] dayCount:", dayCount);
        }

        if (DEBUG_SCHEDULE && DEBUG_ANCHOR) {
            var anchorIndices = [];
            for (var a = 0; a < activities.length; a++) {
                var slot = activities[a] || [];
                for (var b = 0; b < slot.length; b++) {
                    var name = safeText(slot[b].courseName);
                    if (name.indexOf(DEBUG_ANCHOR) !== -1) {
                        anchorIndices.push(a);
                        break;
                    }
                }
            }
            console.log("[pretty] anchor indices:", anchorIndices);
            anchorIndices.forEach(function (index) {
                var plan1Day = index % dayCount;
                var plan1Period = Math.floor(index / dayCount);
                var plan2Day = Math.floor(index / unitCount);
                var plan2Period = index % unitCount;
                console.log(
                    "[pretty] anchor index",
                    index,
                    "plan1(day,period)=",
                    plan1Day,
                    plan1Period,
                    "plan2(day,period)=",
                    plan2Day,
                    plan2Period,
                );
            });
        }

        var grid = Array.from({ length: unitCount }, function () {
            return Array.from({ length: dayCount }, function () {
                return [];
            });
        });
        for (var index = 0; index < activities.length; index++) {
            var day = Math.floor(index / unitCount);
            var period = index % unitCount;
            if (grid[period] && grid[period][day]) {
                grid[period][day] = activities[index] || [];
            }
        }
        return { grid: grid, unitCount: unitCount, dayCount: dayCount };
    }

    function buildPrettyHtml(rawdata, semester) {
        var schedule = normalizeActivities(rawdata);
        if (!schedule) {
            return null;
        }
        var dayLabels = [
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
            "周日",
        ].slice(0, schedule.dayCount);
        var uniqueCourses = new Set();
        schedule.grid.forEach(function (row) {
            row.forEach(function (cell) {
                cell.forEach(function (course) {
                    if (course && course.courseId) {
                        uniqueCourses.add(course.courseId);
                    }
                });
            });
        });
        var headerTitle = semester ? "课程表 · " + semester : "课程表";
        var now = new Date();
        var exportedAt =
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0") +
            " " +
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0");

        var tableHead = dayLabels
            .map(function (label) {
                return "<th>" + label + "</th>";
            })
            .join("");

        var bodyRows = schedule.grid
            .map(function (row, rowIndex) {
                var cells = row
                    .map(function (cell) {
                        if (!cell || !cell.length) {
                            return '<td class="empty"><span>—</span></td>';
                        }
                        var cards = cell
                            .map(function (course) {
                                var courseName = safeText(course.courseName);
                                var teacherName = safeText(course.teacherName);
                                var roomName = safeText(course.roomName);
                                var weekText = parseWeekRanges(
                                    course.vaildWeeks,
                                );
                                var meta = [teacherName, roomName]
                                    .filter(Boolean)
                                    .join(" · ");
                                var weekLine = weekText
                                    ? '<div class="meta small">' +
                                      weekText +
                                      "</div>"
                                    : "";
                                return (
                                    '<div class="card">' +
                                    '<div class="title">' +
                                    (courseName || "未命名课程") +
                                    "</div>" +
                                    (meta
                                        ? '<div class="meta">' + meta + "</div>"
                                        : "") +
                                    weekLine +
                                    "</div>"
                                );
                            })
                            .join("");
                        return "<td>" + cards + "</td>";
                    })
                    .join("");
                return (
                    "<tr>" +
                    '<th class="period">第' +
                    (rowIndex + 1) +
                    "节</th>" +
                    cells +
                    "</tr>"
                );
            })
            .join("");

        return (
            "<!DOCTYPE html>" +
            '<html lang="zh-CN">' +
            "<head>" +
            '<meta charset="utf-8" />' +
            '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
            "<title>" +
            headerTitle +
            "</title>" +
            "<style>" +
            ":root{" +
            "--bg:#f6f1ea;" +
            "--bg2:#eae1d5;" +
            "--card:#ffffff;" +
            "--ink:#1f1d1a;" +
            "--muted:#6c6256;" +
            "--accent:#c45f3d;" +
            "--accent2:#2f6f7e;" +
            "--line:#e1d6c9;" +
            "}" +
            "*{box-sizing:border-box;}" +
            "body{" +
            "margin:0;" +
            "font-family:'Noto Serif SC','Source Han Serif SC','Songti SC',serif;" +
            "color:var(--ink);" +
            "background:linear-gradient(135deg,var(--bg),var(--bg2));" +
            "min-height:100vh;" +
            "}" +
            ".page{" +
            "max-width:1200px;" +
            "margin:0 auto;" +
            "padding:36px 24px 56px;" +
            "animation:fadeIn 0.7s ease both;" +
            "}" +
            ".hero{" +
            "padding:28px 32px;" +
            "background:linear-gradient(120deg,rgba(196,95,61,0.12),rgba(47,111,126,0.12));" +
            "border:1px solid rgba(196,95,61,0.25);" +
            "border-radius:22px;" +
            "box-shadow:0 20px 40px rgba(0,0,0,0.08);" +
            "backdrop-filter:blur(4px);" +
            "}" +
            ".hero h1{" +
            "margin:0 0 8px;" +
            "font-family:'Noto Sans SC','Source Han Sans SC','Microsoft YaHei',sans-serif;" +
            "font-size:28px;" +
            "letter-spacing:1px;" +
            "}" +
            ".hero .meta{" +
            "display:flex;" +
            "flex-wrap:wrap;" +
            "gap:12px;" +
            "font-size:14px;" +
            "color:var(--muted);" +
            "}" +
            ".badge{" +
            "padding:6px 12px;" +
            "background:rgba(196,95,61,0.12);" +
            "border-radius:999px;" +
            "border:1px solid rgba(196,95,61,0.2);" +
            "}" +
            ".table-wrap{" +
            "margin-top:28px;" +
            "overflow:auto;" +
            "border-radius:20px;" +
            "border:1px solid var(--line);" +
            "background:rgba(255,255,255,0.6);" +
            "box-shadow:0 18px 32px rgba(0,0,0,0.06);" +
            "}" +
            "table{" +
            "width:100%;" +
            "border-collapse:separate;" +
            "border-spacing:0;" +
            "min-width:900px;" +
            "}" +
            "thead th{" +
            "position:sticky;" +
            "top:0;" +
            "background:rgba(246,241,234,0.95);" +
            "backdrop-filter:blur(6px);" +
            "font-family:'Noto Sans SC','Source Han Sans SC','Microsoft YaHei',sans-serif;" +
            "font-size:14px;" +
            "letter-spacing:1px;" +
            "text-transform:uppercase;" +
            "padding:14px 12px;" +
            "border-bottom:1px solid var(--line);" +
            "}" +
            "tbody td, tbody th{" +
            "border-bottom:1px solid var(--line);" +
            "border-right:1px solid var(--line);" +
            "vertical-align:top;" +
            "padding:12px;" +
            "}" +
            "tbody tr:last-child td, tbody tr:last-child th{" +
            "border-bottom:none;" +
            "}" +
            "tbody td:last-child, thead th:last-child{" +
            "border-right:none;" +
            "}" +
            ".period{" +
            "min-width:70px;" +
            "text-align:center;" +
            "font-size:13px;" +
            "color:var(--muted);" +
            "background:rgba(250,247,243,0.8);" +
            "}" +
            ".card{" +
            "background:var(--card);" +
            "border-radius:12px;" +
            "padding:10px 12px;" +
            "box-shadow:0 6px 14px rgba(31,29,26,0.08);" +
            "border:1px solid rgba(196,95,61,0.18);" +
            "margin-bottom:10px;" +
            "animation:riseIn 0.5s ease both;" +
            "}" +
            ".card:last-child{margin-bottom:0;}" +
            ".card .title{" +
            "font-family:'Noto Sans SC','Source Han Sans SC','Microsoft YaHei',sans-serif;" +
            "font-size:14px;" +
            "margin-bottom:6px;" +
            "}" +
            ".card .meta{" +
            "font-size:12px;" +
            "color:var(--muted);" +
            "}" +
            ".card .meta.small{" +
            "font-size:11px;" +
            "color:var(--accent2);" +
            "margin-top:4px;" +
            "}" +
            ".empty{" +
            "text-align:center;" +
            "color:#b6a99b;" +
            "}" +
            ".empty span{" +
            "display:inline-block;" +
            "padding:18px 0;" +
            "}" +
            ".footer{" +
            "margin-top:22px;" +
            "font-size:12px;" +
            "color:var(--muted);" +
            "}" +
            "@keyframes fadeIn{" +
            "from{opacity:0;transform:translateY(10px);}" +
            "to{opacity:1;transform:translateY(0);}" +
            "}" +
            "@keyframes riseIn{" +
            "from{opacity:0;transform:translateY(8px);}" +
            "to{opacity:1;transform:translateY(0);}" +
            "}" +
            "@media (max-width: 900px){" +
            ".page{padding:24px 16px 40px;}" +
            ".hero{padding:20px;}" +
            "table{min-width:720px;}" +
            "}" +
            "</style>" +
            "</head>" +
            "<body>" +
            '<div class="page">' +
            '<section class="hero">' +
            "<h1>" +
            headerTitle +
            "</h1>" +
            '<div class="meta">' +
            '<span class="badge">课程数：' +
            uniqueCourses.size +
            "</span>" +
            '<span class="badge">节次：' +
            schedule.unitCount +
            "</span>" +
            '<span class="badge">导出时间：' +
            exportedAt +
            "</span>" +
            "</div>" +
            "</section>" +
            '<div class="table-wrap">' +
            "<table>" +
            "<thead><tr><th></th>" +
            tableHead +
            "</tr></thead>" +
            "<tbody>" +
            bodyRows +
            "</tbody>" +
            "</table>" +
            "</div>" +
            '<div class="footer">来自树维教务导出的课程表，可直接离线打开。</div>' +
            "</div>" +
            "</body>" +
            "</html>"
        );
    }

    var rawdata = findEamsTable();
    var mode = rawdata ? "eams" : null;
    if (!rawdata) {
        rawdata = findGradTable();
        mode = rawdata ? "grad" : null;
    }

    if (!rawdata) {
        alert("加载失败，请确认已进入正确的课表页面。");
        return;
    }

    var semester = getSemester(mode);
    var html = buildPrettyHtml(rawdata, semester);
    if (!html) {
        alert("暂不支持该页面格式，请确认是否为课程表页面。");
        return;
    }

    var filename = sanitizeFilename(semester || "课程表") + "-pretty.html";
    downloadHtml(html, filename);
})();
