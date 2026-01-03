// 在课表页面的浏览器控制台中运行此代码，以下载课程表的 HTML 预览。
// 步骤：
// 1. 打开教务系统的课表页面。
// 2. 按下 F12 打开开发者工具，切换到控制台 (Console) 标签。
// 3. 将下面的代码粘贴到控制台中并回车运行。
// 4. 自动下载课程表的 HTML 预览文件。

(function () {
    "use strict";

    if (typeof window === "undefined" || typeof document === "undefined") {
        return;
    }

    // debug
    var DEBUG_SCHEDULE = false;
    // var DEBUG_ANCHOR = "互联网思维与创新(0506)";

    // 二工大课表时间
    var PERIODS = [
        "08:00 – 08:45",
        "08:50 – 09:35",
        "09:50 – 10:35",
        "10:40 – 11:25",
        "11:25 – 12:10",
        "13:00 – 13:45",
        "13:50 – 14:35",
        "14:50 – 15:35",
        "15:40 – 16:25",
        "16:30 – 17:15",
        "18:00 – 18:45",
        "18:50 – 19:35",
        "19:40 - 20:25",
    ];

    // 确保返回一个有效的字符串，如果输入为 null 或 undefined，则返回空字符串
    function safeText(value) {
        return value ? String(value) : "";
    }

    // 清理课程名中的非法字符（如 \ / : * ? " < > |）
    function sanitizeFilename(name) {
        var cleaned = safeText(name).trim();
        if (!cleaned) {
            return "课程表";
        }
        return cleaned.replace(/[\\/:*?"<>|]/g, "_");
    }

    // 创建一个 HTML 文件并下载
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

    // 尝试查找和返回一个“毕业生课表”的表格元素，如果未找到则返回 null
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

    // 查找并返回一个包含课程数据的表格元素，若没有找到则返回 null
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

    // 根据 mode 返回当前学期的名称或标识，支持 eams 和 grad 模式
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

    // 将传入的周次字符串解析为一个表示周次范围的字符串
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

    // 规范化课程数据，按天和节次将课程安排映射到一个二维网格 grid，并推断每周的课时和周数
    function normalizeActivities(rawdata) {
        var activities = rawdata && rawdata.activities;
        if (!activities || !activities.length) {
            return null;
        }
        var unitCount = PERIODS.length;
        var dayCount = rawdata.endAtSat ? 6 : 7;
        var sourcePeriodCount = rawdata.unitCount;
        if (!sourcePeriodCount) {
            if (rawdata.unitCounts && dayCount) {
                sourcePeriodCount = Math.round(rawdata.unitCounts / dayCount);
            } else {
                sourcePeriodCount = Math.round(activities.length / dayCount);
            }
        }
        if (sourcePeriodCount) {
            var inferredDays = Math.round(
                activities.length / sourcePeriodCount,
            );
            if (inferredDays >= 5 && inferredDays <= 7) {
                dayCount = inferredDays;
            }
        }
        if (DEBUG_SCHEDULE) {
            console.log("[pretty] unitCount:", unitCount);
            console.log("[pretty] unitCounts:", rawdata.unitCounts);
            console.log("[pretty] sourcePeriodCount:", sourcePeriodCount);
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
                var plan2Day = Math.floor(index / sourcePeriodCount);
                var plan2Period = index % sourcePeriodCount;
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
            var day = Math.floor(index / sourcePeriodCount);
            var period = index % sourcePeriodCount;
            if (period >= unitCount) {
                continue;
            }
            if (grid[period] && grid[period][day]) {
                grid[period][day] = activities[index] || [];
            }
        }
        return { grid: grid, unitCount: unitCount, dayCount: dayCount };
    }

    // 根据规范化后的课程数据和学期信息，构建并返回一个格式化的 HTML 课表字符串，包含课程名称、教师、教室等信息
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
                            return "<td></td>";
                        }
                        var courses = cell
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
                                    ? '<div class="week-range">' +
                                      weekText +
                                      "</div>"
                                    : "";
                                return (
                                    '<div class="course">' +
                                    '<div class="course-name">' +
                                    (courseName || "未命名课程") +
                                    "</div>" +
                                    (meta
                                        ? '<div class="course-meta">' +
                                          meta +
                                          "</div>"
                                        : "") +
                                    weekLine +
                                    "</div>"
                                );
                            })
                            .join("");
                        return "<td>" + courses + "</td>";
                    })
                    .join("");
                var timeLabel = PERIODS[rowIndex]
                    ? " " + PERIODS[rowIndex]
                    : "";
                return (
                    "<tr>" +
                    '<th class="period">第' +
                    (rowIndex + 1) +
                    "节" +
                    timeLabel +
                    "</th>" +
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
            "</head>" +
            "<body>" +
            "<h1>" +
            headerTitle +
            "</h1>" +
            "<div>" +
            '<span class="count-courses">课程数：' +
            uniqueCourses.size +
            "</span>" +
            '<span class="count-periods">节次：' +
            schedule.unitCount +
            "</span>" +
            '<span class="exported-at">导出时间：' +
            exportedAt +
            "</span>" +
            "</div>" +
            "<table>" +
            "<thead><tr><th></th>" +
            tableHead +
            "</tr></thead>" +
            "<tbody>" +
            bodyRows +
            "</tbody>" +
            "</table>" +
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

    var filename = sanitizeFilename(semester || "课程表") + ".html";
    downloadHtml(html, filename);
})();
