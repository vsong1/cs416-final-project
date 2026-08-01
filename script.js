(function () {

    var CSV_PATH = 'data/ZonAnn.Ts+dSST.csv';

    var DATA = [];

    var state = {
        scene: 0,              // which scene (see SCENES) is showing
        view: 'zonal',         // explorer resolution: 'global' | 'hemisphere' | 'zonal'
        brushExtent: null,     // [startYear, endYear] currently selected in the explorer, or null = full record
    };

    var SCENES = [
        { id: 0, label: 'Intro' },
        { id: 1, label: 'Trend' },
        { id: 2, label: 'Latitude' },
        { id: 3, label: 'Explore' }
    ];

    var ZONAL_BANDS = [
        { key: '64N-90N', label: '64°N–90°N (Arctic)', abbr: 'Arctic' },
        { key: '44N-64N', label: '44°N–64°N', abbr: '44–64°N' },
        { key: '24N-44N', label: '24°N–44°N', abbr: '24–44°N' },
        { key: 'EQU-24N', label: 'Equator–24°N', abbr: 'Eq–24°N' },
        { key: '24S-EQU', label: '24°S–Equator', abbr: '24°S–Eq' },
        { key: '44S-24S', label: '24°S–44°S', abbr: '24–44°S' },
        { key: '64S-44S', label: '44°S–64°S', abbr: '44–64°S' },
        { key: '90S-64S', label: '64°S–90°S (Antarctic)', abbr: 'Antarctic' }
    ];

    var VIEWS = {
        global: {
            bands: [{ key: 'Glob', label: 'Global mean', abbr: 'Global' }],
            panelTitle: 'Average anomaly — global mean'
        },
        hemisphere: {
            bands: [
                { key: 'NHem', label: 'Northern Hemisphere', abbr: 'N. Hem.' },
                { key: 'SHem', label: 'Southern Hemisphere', abbr: 'S. Hem.' }
            ],
            panelTitle: 'Average anomaly by hemisphere'
        },
        zonal: {
            bands: ZONAL_BANDS,
            panelTitle: 'Average anomaly by latitude'
        }
    };
    var currentView = 'zonal';
    function getActiveBands() { return VIEWS[currentView].bands; }

    // Temperature colors
    var VERY_COLD = '#173A56', COLD = '#2E6E9E', MID = '#EDECE4',
        WARM = '#D69A6B', HOT = '#9E2B25', VERY_HOT = '#6E1815';

    var colorInterp = d3.interpolateRgbBasis([VERY_COLD, COLD, MID, WARM, HOT, VERY_HOT]);

    // Moving average calculation
    function rollingAvg(arr, key, w) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            if (i < w - 1) continue;
            var slice = arr.slice(i - w + 1, i + 1);
            var vals = slice.map(function (s) { return s[key]; }).filter(function (v) { return v != null; });
            if (vals.length < w) continue;
            out.push({ Year: arr[i].Year, value: d3.mean(vals) });
        }
        return out;
    }

    // Disable all overlays on load
    var tooltipEl, currentBrushExtent, brushAxisRef = null;

    // Toggle tooltip functions
    function showTooltip(event, html) {
        tooltipEl.innerHTML = html;
        tooltipEl.style.opacity = 1;
        var pad = 16;
        var left = event.clientX + pad;
        var top = event.clientY + pad;
        if (left + 190 > window.innerWidth) left = event.clientX - 190;
        if (top + 60 > window.innerHeight) top = event.clientY - 70;
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
    }
    function hideTooltip() { tooltipEl.style.opacity = 0; }

    /* ================= CHART 1: GLOBAL TREND ================= */
    function renderGlobalChart() {
        var container = d3.select('#chartGlobal');
        container.selectAll('*').remove(); // reset/clear all child elements
        var width = container.node().clientWidth || 700;
        var height = 360;
        var margin = { top: 20, right: 24, bottom: 34, left: 50 };
        var innerW = Math.max(50, width - margin.left - margin.right);
        var innerH = height - margin.top - margin.bottom;

        var svg = container.append('svg').attr('width', width).attr('height', height);
        var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        var x = d3.scaleLinear().domain(d3.extent(DATA, function (d) { return d.Year; })).range([0, innerW]);
        var y = d3.scaleLinear().domain(d3.extent(DATA, function (d) { return d.Glob; })).nice().range([innerH, 0]);

        g.append('g').selectAll('line').data(y.ticks(6)).join('line')
            .attr('class', 'grid-line').attr('x1', 0).attr('x2', innerW)
            .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); });

        var barW = Math.max(0.8, innerW / DATA.length - 1);
        g.selectAll('.bar').data(DATA).join('rect')
            .attr('class', 'bar')
            .attr('x', function (d) { return x(d.Year) - barW / 2; })
            .attr('width', barW)
            .attr('y', function (d) { return d.Glob >= 0 ? y(d.Glob) : y(0); })
            .attr('height', function (d) { return Math.abs(y(d.Glob) - y(0)); })
            .attr('fill', function (d) { return d.Glob >= 0 ? HOT : COLD; });

        g.append('line').attr('class', 'zero-line')
            .attr('x1', 0).attr('x2', innerW).attr('y1', y(0)).attr('y2', y(0));

        var roll = rollingAvg(DATA, 'Glob', 10);
        var line = d3.line().x(function (d) { return x(d.Year); }).y(function (d) { return y(d.value); }).curve(d3.curveMonotoneX);
        g.append('path').datum(roll).attr('fill', 'none')
            .attr('stroke', '#E3A23D').attr('stroke-width', 2.4).attr('d', line);

        g.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + innerH + ')')
            .call(d3.axisBottom(x).ticks(Math.min(8, Math.floor(innerW / 80))).tickFormat(d3.format('d')).tickSizeOuter(0));
        g.append('g').attr('class', 'axis')
            .call(d3.axisLeft(y).ticks(6).tickFormat(function (d) { return (d > 0 ? '+' : '') + d.toFixed(1) + '°'; }).tickSizeOuter(0));

        // annotations
        if (typeof d3.annotation === 'function') {
            var hottest = DATA.reduce(function (a, b) { return b.Glob > a.Glob ? b : a; });
            var pt1976 = roll.filter(function (d) { return d.Year === 1976; })[0];
            var annotations = [
                {
                    note: { label: '+' + hottest.Glob.toFixed(2) + '°C above the 1951–1980 baseline', title: hottest.Year + ': warmest year on record', wrap: 150 },
                    x: x(hottest.Year), y: y(hottest.Glob),
                    dx: Math.min(-40, x(hottest.Year) - innerW + 40), dy: 10,
                    connector: { end: 'dot' }
                }
            ];
            if (pt1976) {
                annotations.push({
                    note: { label: '10-yr average begins a sustained climb', title: 'Mid-1970s: the turn', wrap: 140 },
                    x: x(1976), y: y(pt1976.value),
                    dx: 16, dy: 16,
                    connector: { end: 'dot' }
                });
            }
            var makeAnnotations = d3.annotation().annotations(annotations);
            g.append('g').attr('class', 'annotation-group').call(makeAnnotations);
        }
    }

    /* ================= CHART 2: ZONES ================= */
    function renderZonesChart() {
        var container = d3.select('#chartZones');
        container.selectAll('*').remove(); // reset/clear all child elements
        var width = container.node().clientWidth || 700;
        var height = 360;
        var margin = { top: 20, right: 24, bottom: 34, left: 50 };
        var innerW = Math.max(50, width - margin.left - margin.right);
        var innerH = height - margin.top - margin.bottom;

        var series = [
            { key: '64N-90N', label: 'Arctic (64°N–90°N)', color: '#a3762d' },
            { key: '24S-24N', label: 'Tropics (24°S–24°N)', color: '#398f69' },
            { key: '90S-64S', label: 'Antarctic (64°S–90°S)', color: '#3260b0' },
            { key: 'Glob', label: 'Global', color: '#eeeeee' }
        ];

        var rolled = series.map(function (s) {
            return { key: s.key, label: s.label, color: s.color, values: rollingAvg(DATA, s.key, 10) };
        });

        var allYears = rolled[0].values.map(function (d) { return d.Year; });
        var x = d3.scaleLinear().domain(d3.extent(allYears)).range([0, innerW]);
        var allVals = [];
        rolled.forEach(function (s) { s.values.forEach(function (d) { allVals.push(d.value); }); });
        var y = d3.scaleLinear().domain(d3.extent(allVals)).nice().range([innerH, 0]);

        var svg = container.append('svg').attr('width', width).attr('height', height);
        var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        g.append('g').selectAll('line').data(y.ticks(6)).join('line')
            .attr('class', 'grid-line').attr('x1', 0).attr('x2', innerW)
            .attr('y1', function (d) { return y(d); }).attr('y2', function (d) { return y(d); });

        g.append('line').attr('class', 'zero-line')
            .attr('x1', 0).attr('x2', innerW).attr('y1', y(0)).attr('y2', y(0));

        var line = d3.line().x(function (d) { return x(d.Year); }).y(function (d) { return y(d.value); }).curve(d3.curveMonotoneX);

        rolled.forEach(function (s) {
            var path = g.append('path').datum(s.values).attr('fill', 'none')
                .attr('stroke', s.color).attr('stroke-width', s.key === 'Glob' ? 2 : 2.3).attr('d', line);
            if (s.dash) path.attr('stroke-dasharray', s.dash);
        });

        g.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + innerH + ')')
            .call(d3.axisBottom(x).ticks(Math.min(8, Math.floor(innerW / 80))).tickFormat(d3.format('d')).tickSizeOuter(0));
        g.append('g').attr('class', 'axis')
            .call(d3.axisLeft(y).ticks(6).tickFormat(function (d) { return (d > 0 ? '+' : '') + d.toFixed(1) + '°'; }).tickSizeOuter(0));

        var legend = d3.select('#zoneLegend');
        legend.selectAll('*').remove();
        rolled.forEach(function (s) {
            var item = legend.append('div').attr('class', 'legend-item');
            item.append('span').attr('class', 'legend-swatch').style('background', s.color);
            item.append('span').text(s.label);
        });
    }

    /* ================= HEAT LEGEND ================= */
    function renderHeatLegend(minVal, maxVal) {
        var el = document.getElementById('heatLegend');
        el.innerHTML = '';
        var stops = [VERY_COLD, COLD, MID, WARM, HOT, VERY_HOT];
        var grad = document.createElement('div');
        grad.className = 'grad';
        grad.style.background = 'linear-gradient(90deg, ' + stops.join(',') + ')';
        var lo = document.createElement('span');
        lo.textContent = minVal.toFixed(1) + '°';
        var hi = document.createElement('span');
        hi.textContent = '+' + maxVal.toFixed(1) + '°';
        el.appendChild(lo);
        el.appendChild(grad);
        el.appendChild(hi);
    }

    /* ================= HEATMAP + BRUSH ================= */
    function renderHeatmap() {
        var container = d3.select('#heatmap');
        container.selectAll('*').remove(); // reset/clear all child elements
        var width = container.node().clientWidth || 700;

        var activeBands = getActiveBands();
        var count = activeBands.length;

        var targetTotal = 240;
        var minRow = 34, maxRow = 130;
        var rowH = Math.max(minRow, Math.min(maxRow, targetTotal / count));
        var labelFontSize = '12px';

        var margin = { top: 6, right: 14, bottom: 4, left: 150 };
        var innerW = Math.max(80, width - margin.left - margin.right);
        var innerH = rowH * count;
        var height = innerH + margin.top + margin.bottom;

        var years = DATA.map(function (d) { return d.Year; });
        var x = d3.scaleBand().domain(years).range([0, innerW]).paddingInner(0.05);
        var y = d3.scaleBand().domain(activeBands.map(function (b) { return b.key; })).range([0, innerH]).paddingInner(count > 2 ? 0.1 : 0.15);

        var allVals = [];
        DATA.forEach(function (d) { activeBands.forEach(function (b) { if (d[b.key] != null) allVals.push(d[b.key]); }); });
        var ext = d3.extent(allVals);
        var color = d3.scaleDiverging(colorInterp).domain([ext[0], 0, ext[1]]);
        renderHeatLegend(ext[0], ext[1]);

        var svg = container.append('svg').attr('width', width).attr('height', height);
        var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        g.selectAll('.row-label').data(activeBands, function (b) { return b.key; }).join('text')
            .attr('class', 'row-label')
            .attr('x', -10)
            .attr('y', function (d) { return y(d.key) + y.bandwidth() / 2; })
            .attr('dy', '0.32em')
            .attr('text-anchor', 'end')
            .style('font-family', 'var(--mono)')
            .style('font-size', labelFontSize)
            .style('fill', 'var(--text-mid)')
            .text(function (d) { return d.label; });

        var cellsG = g.append('g').attr('class', 'cells');
        activeBands.forEach(function (b) {
            cellsG.selectAll(null)
                .data(DATA)
                .join('rect')
                .attr('class', 'heat-cell')
                .attr('x', function (d) { return x(d.Year); })
                .attr('y', y(b.key))
                .attr('width', x.bandwidth())
                .attr('height', y.bandwidth())
                .attr('fill', function (d) { return d[b.key] != null ? color(d[b.key]) : '#222'; })
                .on('mousemove', function (event, d) {
                    var v = d[b.key];
                    showTooltip(event, '<span class="tt-year">' + d.Year + '</span> · ' + b.label + '<br>' + (v >= 0 ? '+' : '') + v.toFixed(2) + '°C');
                    d3.select(this).attr('stroke', 'var(--amber)').attr('stroke-width', 1.1);
                })
                .on('mouseleave', function () {
                    hideTooltip();
                    d3.select(this).attr('stroke', 'none');
                });
        });

        renderBrushAxis(innerW, margin.left);
        applyBrushDim();
    }

    function renderBrushAxis(innerW, marginLeft) {
        var container = d3.select('#brushAxis');
        container.selectAll('*').remove();
        var height = 36;
        var svg = container.append('svg').attr('width', innerW + marginLeft + 14).attr('height', height);
        var g = svg.append('g').attr('transform', 'translate(' + marginLeft + ',2)');

        var xLin = d3.scaleLinear().domain(d3.extent(DATA, function (d) { return d.Year; })).range([0, innerW]);

        g.append('g').attr('class', 'axis')
            .call(d3.axisBottom(xLin).ticks(Math.min(10, Math.floor(innerW / 70))).tickFormat(d3.format('d')).tickSize(6));

        var brush = d3.brushX()
            .extent([[0, -2], [innerW, 20]])
            .on('end', brushed);

        var brushG = g.append('g').attr('class', 'brush').call(brush);

        if (currentBrushExtent) {
            brushG.call(brush.move, [xLin(currentBrushExtent[0]), xLin(currentBrushExtent[1])]);
        }

        function brushed(event) {
            if (!event.selection) {
                currentBrushExtent = null;
            } else {
                var d0 = xLin.invert(event.selection[0]);
                var d1 = xLin.invert(event.selection[1]);
                currentBrushExtent = [Math.round(d0), Math.round(d1)];
            }
            updateSidePanel();
            applyBrushDim();
        }

        brushAxisRef = { brushG: brushG, brush: brush, xLin: xLin };
    }

    function setBrushRange(y0, y1) {
        if (!brushAxisRef) return;
        if (y0 == null) {
            brushAxisRef.brushG.call(brushAxisRef.brush.move, null);
        } else {
            var x0 = brushAxisRef.xLin(y0), x1 = brushAxisRef.xLin(y1);
            brushAxisRef.brushG.call(brushAxisRef.brush.move, [x0, x1]);
        }
    }

    function applyBrushDim() {
        d3.selectAll('.heat-cell').attr('opacity', function (d) {
            if (!currentBrushExtent) return 1;
            return (d.Year >= currentBrushExtent[0] && d.Year <= currentBrushExtent[1]) ? 1 : 0.16;
        });
        var hint = document.getElementById('explorerHint');
        if (currentBrushExtent) {
            hint.textContent = 'Selected years: ' + currentBrushExtent[0] + '\u2013' + currentBrushExtent[1];
        } else {
            hint.textContent = 'Selected years: 1880\u20132025 (full record)';
        }
    }

    function updateSidePanel() {
        var activeBands = getActiveBands();
        var range = currentBrushExtent || d3.extent(DATA, function (d) { return d.Year; });
        var filtered = DATA.filter(function (d) { return d.Year >= range[0] && d.Year <= range[1]; });

        document.getElementById('sideTitle').textContent = VIEWS[currentView].panelTitle;

        var avgs = activeBands.map(function (b) {
            return { key: b.key, label: b.label, abbr: b.abbr, avg: d3.mean(filtered, function (d) { return d[b.key]; }) };
        });

        var maxAbs = d3.max(avgs, function (d) { return Math.abs(d.avg); }) || 1;
        var scale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, 100]);

        var container = d3.select('#sideBars');
        var rows = container.selectAll('.side-bar-row').data(avgs, function (d) { return d.key; });

        var enter = rows.enter().append('div').attr('class', 'side-bar-row');
        enter.append('span').attr('class', 'sb-label');
        var trackWrap = enter.append('div').attr('class', 'side-bar-track');
        trackWrap.append('div').attr('class', 'side-bar-zero');
        trackWrap.append('div').attr('class', 'side-bar-fill');
        enter.append('span').attr('class', 'sb-value');

        rows.exit().remove();

        var merged = enter.merge(rows);
        merged.select('.sb-label').text(function (d) { return d.abbr; }).attr('title', function (d) { return d.label; });
        merged.select('.side-bar-zero').style('left', scale(0) + '%');
        merged.select('.side-bar-fill')
            .style('background', function (d) { return d.avg >= 0 ? 'var(--hot)' : 'var(--cold)'; })
            .style('left', function (d) { return Math.min(scale(0), scale(d.avg)) + '%'; })
            .style('width', function (d) { return Math.abs(scale(d.avg) - scale(0)) + '%'; });
        merged.select('.sb-value').text(function (d) { return (d.avg >= 0 ? '+' : '') + d.avg.toFixed(2) + '\u00b0'; });
    }

    /* ================= VIEW SWITCHER ================= */
    function setActiveView(view) {
        currentView = view;
        document.querySelectorAll('.view-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
        renderHeatmap();
        updateSidePanel();
    }

    /* ================= SCENE NAVIGATION ================= */
    function buildNavDots() {
        var wrap = d3.select('#navDots');
        wrap.selectAll('*').remove();
        var dots = wrap.selectAll('.nav-dot').data(SCENES).join('button')
            .attr('class', 'nav-dot')
            .attr('type', 'button')
            .attr('aria-label', function (d) { return 'Go to scene: ' + d.label; })
            .on('click', function (event, d) { goToScene(d.id); });
        dots.append('span').attr('class', 'nav-dot-mark');
        dots.append('span').attr('class', 'nav-dot-label').text(function (d) { return d.label; });
    }

    function refreshNav() {
        d3.selectAll('.nav-dot').classed('active', function (d) { return d.id === state.scene; });
        document.getElementById('navPrev').disabled = state.scene === 0;
        document.getElementById('navNext').disabled = state.scene === SCENES.length - 1;
    }

    function goToScene(i) {
        if (i < 0 || i >= SCENES.length || i === state.scene) return;
        var prev = document.getElementById('scene-' + state.scene);
        var next = document.getElementById('scene-' + i);
        if (prev) prev.classList.remove('active');
        if (next) next.classList.add('active');
        state.scene = i;
        refreshNav();
        // charts are already rendered once at load; just resize the ones
        // becoming visible in case the viewport changed while hidden.
        if (i === 1) renderGlobalChart();
        if (i === 2) renderZonesChart();
        if (i === 3) renderHeatmap();
    }

    function nextScene() { goToScene(Math.min(state.scene + 1, SCENES.length - 1)); }
    function prevScene() { goToScene(Math.max(state.scene - 1, 0)); }

    /* ================= INIT ================= */
    function renderAll() {
        renderGlobalChart();
        renderZonesChart();
        renderHeatmap();
        updateSidePanel();
    }

    function rowConverter(d) {
        var out = { Year: +d.Year };
        Object.keys(d).forEach(function (k) {
            if (k === 'Year') return;
            var raw = d[k];
            if (raw === undefined || raw === null) { out[k] = null; return; }
            var v = String(raw).trim();
            out[k] = (v === '' || v === '***' || v === 'NA') ? null : +v;
        });
        return out;
    }

    function boot() {
        tooltipEl = document.getElementById('tooltip');

        document.getElementById('navPrev').addEventListener('click', prevScene);
        document.getElementById('navNext').addEventListener('click', nextScene);
        buildNavDots();
        refreshNav();

        document.getElementById('resetBrush').addEventListener('click', function () {
            setBrushRange(null);
        });

        document.querySelectorAll('.view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setActiveView(btn.getAttribute('data-view'));
            });
        });

        renderAll();

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                renderGlobalChart();
                renderZonesChart();
                renderHeatmap();
                updateSidePanel();
            }, 220);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        d3.csv(CSV_PATH, rowConverter).then(function (rows) {
            DATA = rows.filter(function (d) { return d.Year != null && !isNaN(d.Year); })
                .sort(function (a, b) { return a.Year - b.Year; });

            var yearBounds = d3.extent(DATA, function (d) { return d.Year; });
            // maxYear = yearBounds[1];

            boot();
        });
    });

})();