
      const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba";
      const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
      const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";
      const ATHLETE_ID = "5104157";
      const TEAM_ID = "24";
      const PLAYER_NAME = "Victor Wembanyama";
      const RECORD = 3830;
      const AUTO_REFRESH_MS = 5 * 60 * 1000;
      const COMPLETED_CACHE_MS = 60 * 60 * 1000;

      // Regular-season career totals; fixed because every player here is retired.
      const ALL_TIME_LEADERS = [
        { name: "Hakeem Olajuwon", blocks: 3830 },
        { name: "Dikembe Mutombo", blocks: 3289 },
        { name: "Kareem Abdul-Jabbar", blocks: 3189 },
        { name: "Mark Eaton", blocks: 3064 },
        { name: "Tim Duncan", blocks: 3020 },
        { name: "David Robinson", blocks: 2954 },
        { name: "Patrick Ewing", blocks: 2894 },
        { name: "Shaquille O'Neal", blocks: 2732 },
        { name: "Tree Rollins", blocks: 2542 },
        { name: "Robert Parish", blocks: 2361 },
      ];
      const ROUND_MILESTONES = [750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500];

      // Projection assumptions. The horizon runs through his age-36 season (2039-40).
      const FINAL_SEASON = 2040;
      const SCENARIOS = [
        { key: "high", label: "High", color: "#b98a2c", dash: "", bpgScale: 1, games: 72, decline: 0 },
        { key: "mid", label: "Mid", color: "#2a8db3", dash: "7 5", bpgScale: 1, games: 65, decline: 0.04 },
        { key: "conservative", label: "Conservative", color: "#c35a52", dash: "2 4", bpgScale: 0.75, games: 60, decline: 0 },
      ];
      const DECLINE_STARTS = 2035; // first season of the mid scenario's annual decline (age 31)

      const $ = (id) => document.getElementById(id);
      const els = {
        status: $("status"),
        refreshButton: $("refresh-button"),
        error: $("error"),
        banner: $("season-banner"),
        heroNumber: $("hero-number"),
        numberMain: $("number-main"),
        chaseCurrent: $("chase-current"),
        chasePercent: $("chase-percent"),
        chaseBar: $("chase-bar"),
        chaseFill: $("chase-fill"),
        chaseRemaining: $("chase-remaining"),
        seasonKpiLabel: $("season-kpi-label"),
        seasonBlocks: $("season-blocks"),
        seasonGames: $("season-games"),
        careerBpg: $("career-bpg"),
        careerGames: $("career-games"),
        seasonBpgLabel: $("season-bpg-label"),
        seasonBpg: $("season-bpg"),
        seasonRank: $("season-rank"),
        playerAge: $("player-age"),
        playerTeam: $("player-team"),
        streakCount: $("streak-count"),
        streakDots: $("streak-dots"),
        streakBlocks: $("streak-blocks"),
        streakBest: $("streak-best"),
        streakBestLabel: $("streak-best-label"),
        lastGameMeta: $("last-game-meta"),
        lastGameMatchup: $("last-game-matchup"),
        lastBlk: $("last-blk"),
        lastPts: $("last-pts"),
        lastReb: $("last-reb"),
        lastMin: $("last-min"),
        lastGameNote: $("last-game-note"),
        milestones: $("milestones"),
        projectionLegend: $("projection-legend"),
        projectionChart: $("projection-chart"),
        projectionTooltip: $("projection-tooltip"),
        projectionSummary: $("projection-summary"),
        projectionTable: $("projection-table"),
        projectionNote: $("projection-note"),
        gameLog: $("game-log"),
        gameLogSeason: $("game-log-season"),
        gameLogToggle: $("game-log-toggle"),
        byYear: $("by-year"),
        allTimeLeaders: $("all-time-leaders"),
        seasonLeaders: $("season-leaders"),
        seasonLeadersLabel: $("season-leaders-label"),
      };

      let refreshTimer = null;
      let statusTimer = null;
      let loading = false;
      let lastLoadedAt = null;
      let showFullLog = false;
      let latestGames = [];
      let lastProjectionArgs = null;
      const responseCache = new Map();

      function fmtNumber(value) {
        return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "--";
      }

      function fmtDecimal(value, digits = 1) {
        return Number.isFinite(value) ? value.toFixed(digits) : "--";
      }

      function parseNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
      }

      function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        })[c]);
      }

      function formatDate(value, options = { month: "short", day: "numeric" }) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "--";
        return new Intl.DateTimeFormat(undefined, options).format(date);
      }

      function timeAgoLabel(value) {
        const when = new Date(value);
        if (Number.isNaN(when.getTime())) return "--";
        const minutes = Math.max(0, Math.floor((Date.now() - when.getTime()) / 60000));
        if (minutes < 1) return "just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.round(hours / 24)}d ago`;
      }

      // ESPN labels a season by the year it ends: 2026-27 is 2027.
      function currentSeasonYear(now = new Date()) {
        return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
      }

      function seasonLabel(year) {
        return `${year - 1}-${String(year).slice(-2)}`;
      }

      // ESPN core $ref links sometimes come back as http:// and must keep lang/region.
      function espnUrl(ref) {
        const url = new URL(String(ref).replace(/^http:\/\//, "https://"));
        if (url.hostname === "sports.core.api.espn.com") {
          if (!url.searchParams.has("lang")) url.searchParams.set("lang", "en");
          if (!url.searchParams.has("region")) url.searchParams.set("region", "us");
        }
        return url.toString();
      }

      async function fetchJson(url, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(espnUrl(url), {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          return await response.json();
        } finally {
          window.clearTimeout(timeout);
        }
      }

      // Responses that cannot change (finished seasons, names) are reused between refreshes.
      async function fetchCached(url, ttlMs) {
        const hit = responseCache.get(url);
        if (hit && Date.now() - hit.at < ttlMs) return hit.data;
        const data = await fetchJson(url);
        responseCache.set(url, { at: Date.now(), data });
        return data;
      }

      function coreStat(payload, category, name) {
        const group = payload?.splits?.categories?.find((c) => c.name === category);
        const stat = group?.stats?.find((s) => s.name === name);
        return stat ? parseNumber(stat.value) : null;
      }

      // ---- Game log -------------------------------------------------------

      // The gamelog's "Regular Season" section also lists All-Star games and the
      // NBA Cup Championship, neither of which counts in regular-season stats.
      const NON_COUNTING_GAME = /all-star|cup championship/i;

      function parseGameLog(payload, season) {
        const labels = payload?.labels || [];
        const index = (label) => labels.indexOf(label);
        const col = { MIN: index("MIN"), PTS: index("PTS"), REB: index("REB"), BLK: index("BLK") };
        if (col.BLK < 0) throw new Error("Game log is missing blocks");
        const meta = payload?.events || {};
        const games = [];

        for (const seasonType of payload?.seasonTypes || []) {
          const name = seasonType.displayName || "";
          const type = /regular/i.test(name) ? "regular" : /post/i.test(name) ? "post" : /pre/i.test(name) ? "pre" : "";
          if (!type || type === "pre") continue;
          for (const category of seasonType.categories || []) {
            for (const entry of category.events || []) {
              const event = meta[entry.eventId];
              if (!event) continue;
              const stats = entry.stats || [];
              const note = event.eventNote || "";
              if (type === "regular" && NON_COUNTING_GAME.test(note)) continue;
              games.push({
                id: entry.eventId,
                season,
                type,
                round: type === "post" ? category.displayName : note,
                date: event.gameDate,
                opponent: event.opponent?.displayName || event.opponent?.abbreviation || "Opponent",
                opponentAbbr: event.opponent?.abbreviation || "",
                opponentLogo: event.opponent?.logo || "",
                atVs: event.atVs === "@" ? "@" : "vs.",
                result: event.gameResult || "",
                score: event.score || "",
                minutes: parseNumber(stats[col.MIN]),
                points: parseNumber(stats[col.PTS]),
                rebounds: parseNumber(stats[col.REB]),
                blocks: parseNumber(stats[col.BLK]),
              });
            }
          }
        }
        return games.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      async function loadSeasonGames(season, current) {
        const url = `${ESPN_WEB}/athletes/${ATHLETE_ID}/gamelog?season=${season}`;
        const payload = current ? await fetchJson(url) : await fetchCached(url, COMPLETED_CACHE_MS);
        // ESPN falls back to another season when the requested one has no games.
        const returned = payload?.filters?.find((f) => f.name === "season")?.value;
        if (returned && String(returned) !== String(season)) return [];
        return parseGameLog(payload, season);
      }

      // Games are newest first. Sat-out games never appear in the log, so they
      // cannot break the streak; zero-minute appearances are skipped too.
      function computeStreak(regularGames) {
        let streak = 0;
        for (const game of regularGames) {
          if (game.minutes <= 0 || (game.live && game.blocks < 1)) continue;
          if (game.blocks < 1) break;
          streak += 1;
        }
        return streak;
      }

      function longestStreak(regularGames) {
        let best = 0;
        let run = 0;
        for (const game of [...regularGames].reverse()) {
          if (game.minutes <= 0) continue;
          run = game.blocks >= 1 ? run + 1 : 0;
          best = Math.max(best, run);
        }
        return best;
      }

      // ---- Live game ------------------------------------------------------

      // The summary endpoint's box score updates within seconds; the game log
      // and career stats can lag a live game by many minutes.
      function parseLiveGame(summary, season) {
        const competition = summary?.header?.competitions?.[0];
        if (summary?.header?.season?.type !== 2) return null;
        if ((competition?.notes || []).some((n) => NON_COUNTING_GAME.test(n?.headline || ""))) return null;
        const state = competition?.status?.type?.state;
        if (state !== "in" && state !== "post") return null;
        const team = summary.boxscore?.players?.find((t) => String(t.team?.id) === TEAM_ID);
        const table = team?.statistics?.[0];
        const keys = table?.keys || table?.names || [];
        const row = table?.athletes?.find((a) => String(a.athlete?.id) === ATHLETE_ID);
        if (!row || row.didNotPlay || !row.stats?.length) return null;
        const stat = (key) => parseNumber(row.stats[keys.indexOf(key)]);
        const us = competition.competitors.find((c) => String(c.team?.id) === TEAM_ID);
        const them = competition.competitors.find((c) => String(c.team?.id) !== TEAM_ID);
        const scores = [parseNumber(us?.score), parseNumber(them?.score)];
        return {
          id: String(summary.header.id),
          season,
          type: "regular",
          live: state === "in",
          round: "",
          date: competition.date,
          opponent: them?.team?.displayName || "Opponent",
          opponentAbbr: them?.team?.abbreviation || "",
          opponentLogo: them?.team?.logos?.[0]?.href || them?.team?.logo || "",
          atVs: us?.homeAway === "home" ? "vs." : "@",
          result: state === "in" ? "Live" : us?.winner ? "W" : "L",
          score: `${Math.max(...scores)}-${Math.min(...scores)}`,
          minutes: stat("minutes"),
          points: stat("points"),
          rebounds: stat("rebounds"),
          blocks: stat("blocks"),
        };
      }

      async function loadLiveGames(ids, season) {
        const games = await Promise.all(ids.map(async (id) => {
          try {
            return parseLiveGame(await fetchJson(`${ESPN_SITE}/summary?event=${encodeURIComponent(id)}`), season);
          } catch (error) {
            console.warn("Live game check failed", id, error);
            return null;
          }
        }));
        return games.filter(Boolean);
      }

      // A live box score replaces the game log's row for the same game, keeping the higher count.
      function mergeLiveGames(games, liveGames) {
        const merged = [...(games || [])];
        for (const live of liveGames) {
          const index = merged.findIndex((g) => g.id === live.id);
          if (index < 0) merged.push(live);
          else if (live.live || live.blocks >= merged[index].blocks) merged[index] = { ...merged[index], ...live };
        }
        return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      // ---- Hero -----------------------------------------------------------

      function setHeroNumber(value) {
        const target = Math.max(0, Math.round(value));
        const start = parseNumber(els.numberMain.dataset.value);
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const startedAt = performance.now();
        const duration = reduceMotion ? 0 : 900;
        els.numberMain.dataset.value = String(target);

        function step(now) {
          const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
          const eased = 1 - Math.pow(1 - progress, 3);
          els.numberMain.textContent = fmtNumber(Math.round(start + (target - start) * eased));
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        els.heroNumber.setAttribute("aria-label", `${fmtNumber(target)} career blocks`);
      }

      function renderChase(careerBlocks) {
        const percent = Math.min(100, (careerBlocks / RECORD) * 100);
        const toTie = Math.max(0, RECORD - careerBlocks);
        setHeroNumber(careerBlocks);
        els.chaseCurrent.textContent = fmtNumber(careerBlocks);
        els.chasePercent.textContent = `${percent.toFixed(1)}%`;
        els.chaseFill.style.width = `${percent}%`;
        els.chaseBar.setAttribute("aria-valuenow", String(careerBlocks));
        els.chaseRemaining.textContent = toTie > 0
          ? `${fmtNumber(toTie)} to tie · ${fmtNumber(toTie + 1)} to break`
          : careerBlocks === RECORD ? "Tied the all-time record" : "All-time blocks leader";
      }

      // ---- Panels ---------------------------------------------------------

      function renderStreak(regularGames) {
        const streak = computeStreak(regularGames);
        els.streakCount.textContent = fmtNumber(streak);
        const played = regularGames.filter((g) => g.minutes > 0);
        const streakGames = played.filter((g) => !(g.live && g.blocks < 1)).slice(0, streak);
        els.streakBlocks.textContent = fmtNumber(streakGames.reduce((sum, g) => sum + g.blocks, 0));
        const season = regularGames[0]?.season;
        els.streakBestLabel.textContent = season ? `Longest in ${seasonLabel(season)}` : "Longest this season";
        els.streakBest.textContent = season ? fmtNumber(longestStreak(regularGames.filter((g) => g.season === season))) : "--";
        els.streakDots.innerHTML = streakGames.length ? [...streakGames].reverse()
          .map((game) => {
            const label = `${formatDate(game.date)} ${game.atVs} ${game.opponentAbbr}: ${game.blocks} ${game.blocks === 1 ? "block" : "blocks"}`;
            return `<li class="${game.blocks > 0 ? "hit" : "miss"}" title="${escapeHtml(label)}"><span class="visually-hidden">${escapeHtml(label)}</span><b aria-hidden="true">${game.blocks}</b><small aria-hidden="true">${escapeHtml(game.opponentAbbr)}</small></li>`;
          })
          .join("") : `<li class="empty">No active streak.</li>`;
      }

      function renderLastGame(game) {
        if (!game) {
          els.lastGameMatchup.textContent = "No games yet";
          return;
        }
        const result = game.result ? `${game.result} ${game.score}` : game.score;
        els.lastGameMatchup.innerHTML = `
          ${game.opponentLogo ? `<img src="${escapeHtml(game.opponentLogo)}" alt="" width="28" height="28" loading="lazy" />` : ""}
          <span>${game.atVs} ${escapeHtml(game.opponent)}</span>
          <span class="result result-${escapeHtml(game.result.toLowerCase())}">${escapeHtml(result)}</span>`;
        els.lastGameMeta.textContent = formatDate(game.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        els.lastBlk.textContent = fmtNumber(game.blocks);
        els.lastPts.textContent = fmtNumber(game.points);
        els.lastReb.textContent = fmtNumber(game.rebounds);
        els.lastMin.textContent = fmtNumber(game.minutes);
        els.lastGameNote.textContent = game.type === "post"
          ? `${game.round || "Playoffs"}. Playoff blocks do not count toward the career record.`
          : "";
      }

      function milestoneList(careerBlocks) {
        const passes = ALL_TIME_LEADERS
          .filter((leader) => leader.blocks >= careerBlocks)
          .map((leader) => leader.name === "Hakeem Olajuwon"
            ? { target: leader.blocks + 1, label: "Break Hakeem Olajuwon's record", record: true }
            : { target: leader.blocks + 1, label: `Pass ${leader.name}`, detail: `${fmtNumber(leader.blocks)}` });
        const rounds = ROUND_MILESTONES
          .filter((target) => target > careerBlocks)
          .map((target) => ({ target, label: `${fmtNumber(target)} career blocks` }));
        const upcoming = [...rounds, ...passes].sort((a, b) => a.target - b.target);
        const record = upcoming.find((m) => m.record);
        const list = upcoming.slice(0, 6);
        if (record && !list.includes(record)) list.push(record);
        return list;
      }

      function renderMilestones(careerBlocks, careerBpg) {
        const list = milestoneList(careerBlocks);
        if (!list.length) {
          els.milestones.innerHTML = `<li class="empty">Every milestone reached.</li>`;
          return;
        }
        els.milestones.innerHTML = list
          .map((m) => {
            const remaining = m.target - careerBlocks;
            const games = careerBpg > 0 ? Math.ceil(remaining / careerBpg) : null;
            return `
              <li class="${m.record ? "record" : ""}">
                <span class="milestone-name">${escapeHtml(m.label)}${m.detail ? ` <small>${m.detail}</small>` : ""}</span>
                <span class="milestone-left"><strong>${fmtNumber(remaining)}</strong> to go${games ? ` <small>~${fmtNumber(games)} games</small>` : ""}</span>
              </li>`;
          })
          .join("");
      }

      function renderGameLog() {
        const games = latestGames;
        if (!games.length) {
          els.gameLog.innerHTML = `<tr><td colspan="7" class="empty">No games yet.</td></tr>`;
          els.gameLogToggle.hidden = true;
          return;
        }
        const visible = showFullLog ? games : games.slice(0, 10);
        els.gameLog.innerHTML = visible
          .map((game) => `
            <tr class="${game.blocks >= 5 ? "big-night" : ""}">
              <td>${formatDate(game.date)}</td>
              <td class="opponent-cell">${game.opponentLogo ? `<img src="${escapeHtml(game.opponentLogo)}" alt="" width="20" height="20" loading="lazy" />` : ""}${game.atVs} ${escapeHtml(game.opponentAbbr || game.opponent)}</td>
              <td class="result-${escapeHtml(game.result.toLowerCase())}">${escapeHtml(game.result)} ${escapeHtml(game.score)}</td>
              <td class="num">${fmtNumber(game.minutes)}</td>
              <td class="num">${fmtNumber(game.points)}</td>
              <td class="num">${fmtNumber(game.rebounds)}</td>
              <td class="num blk">${fmtNumber(game.blocks)}</td>
            </tr>`)
          .join("");
        els.gameLogToggle.hidden = games.length <= 10;
        els.gameLogToggle.textContent = showFullLog ? "Show last 10" : `Show all ${games.length} games`;
      }

      function renderByYear(payload) {
        const totals = payload?.categories?.find((c) => c.name === "totals");
        const averages = payload?.categories?.find((c) => c.name === "averages");
        if (!totals) throw new Error("Year-by-year totals missing");
        const blkIndex = totals.names.indexOf("blocks");
        const gpIndex = averages?.names.indexOf("gamesPlayed") ?? -1;
        const bpgIndex = averages?.names.indexOf("avgBlocks") ?? -1;
        const rows = totals.statistics.map((row, i) => {
          const avg = averages?.statistics?.[i]?.stats || [];
          return {
            year: parseNumber(row.season?.year),
            label: row.season?.displayName || String(row.season?.year || ""),
            blocks: parseNumber(row.stats[blkIndex]),
            games: gpIndex >= 0 ? parseNumber(avg[gpIndex]) : null,
            bpg: bpgIndex >= 0 ? parseNumber(avg[bpgIndex]) : null,
          };
        }).reverse();
        const high = Math.max(...rows.map((r) => r.blocks));
        els.byYear.innerHTML = rows
          .map((row) => `
            <tr>
              <td class="year">${escapeHtml(row.label)}${row.blocks === high && rows.length > 1 ? ` <span class="tag">Career high</span>` : ""}</td>
              <td class="num">${row.games == null ? "--" : fmtNumber(row.games)}</td>
              <td class="num">${row.bpg == null ? "--" : fmtDecimal(row.bpg)}</td>
              <td class="num blk">${fmtNumber(row.blocks)}</td>
            </tr>`)
          .join("") + `
            <tr class="total-row">
              <td>Career</td>
              <td class="num">${fmtNumber(rows.reduce((s, r) => s + (r.games || 0), 0))}</td>
              <td class="num">${fmtDecimal(parseNumber(averages?.totals?.[bpgIndex]))}</td>
              <td class="num blk">${fmtNumber(parseNumber(totals.totals?.[blkIndex]))}</td>
            </tr>`;
        return rows;
      }

      function renderAllTime(careerBlocks) {
        const rows = [...ALL_TIME_LEADERS, { name: PLAYER_NAME, blocks: careerBlocks, current: true }]
          .sort((a, b) => b.blocks - a.blocks);
        const wembyIndex = rows.findIndex((r) => r.current);
        const shown = wembyIndex < 10 ? rows.slice(0, 11) : rows.slice(0, 10);
        els.allTimeLeaders.innerHTML = shown
          .map((row, i) => `
            <li class="${row.current ? "current" : ""}">
              <span>#${i + 1} ${escapeHtml(row.name)}</span><strong>${fmtNumber(row.blocks)}</strong>
            </li>`)
          .join("") + (wembyIndex >= 10
            ? `<li class="ellipsis">...</li><li class="current"><span>${PLAYER_NAME}</span><strong>${fmtNumber(careerBlocks)}</strong></li>`
            : "");
      }

      // Leaders 404 until a few games into a new season; fall back to the previous one.
      async function renderSeasonLeaders(season) {
        try {
          return { season, rank: await renderSeasonLeadersFor(season) };
        } catch (error) {
          console.warn(`No ${seasonLabel(season)} leaders yet`, error);
          return { season: season - 1, rank: await renderSeasonLeadersFor(season - 1) };
        }
      }

      async function renderSeasonLeadersFor(season) {
        const payload = await fetchCached(`${ESPN_CORE}/seasons/${season}/types/2/leaders`, COMPLETED_CACHE_MS);
        const category = payload?.categories?.find((c) => c.name === "blocksPerGame");
        if (!category?.leaders?.length) throw new Error("No blocks leaders");
        const top = category.leaders.slice(0, 5);
        const rows = await Promise.all(top.map(async (leader) => {
          const id = leader.athlete?.$ref?.match(/athletes\/(\d+)/)?.[1];
          let name = id === ATHLETE_ID ? PLAYER_NAME : "";
          if (!name && leader.athlete?.$ref) {
            try {
              name = (await fetchCached(leader.athlete.$ref, 24 * 60 * 60 * 1000)).displayName;
            } catch {
              name = "";
            }
          }
          return { id, name: name || "Unknown", value: leader.displayValue };
        }));
        els.seasonLeadersLabel.textContent = seasonLabel(season);
        els.seasonLeaders.innerHTML = rows
          .map((row, i) => `
            <li class="${row.id === ATHLETE_ID ? "current" : ""}">
              <span>#${i + 1} ${escapeHtml(row.name)}</span><strong>${escapeHtml(row.value)}</strong>
            </li>`)
          .join("");
        const wemby = rows.findIndex((r) => r.id === ATHLETE_ID);
        return wemby >= 0 ? wemby + 1 : null;
      }

      async function renderBanner(season) {
        const payload = await fetchJson(`${ESPN_SITE}/teams/${TEAM_ID}/schedule?season=${season}&seasontype=2`);
        const events = payload?.events || [];
        const next = events.find((e) => e.competitions?.[0]?.status?.type?.state !== "post");
        const played = events.filter((e) => e.competitions?.[0]?.status?.type?.completed).length;
        // Live games, plus games that ended in the last 8 hours (the game log can lag the final).
        const liveIds = events
          .filter((e) => {
            const state = e.competitions?.[0]?.status?.type?.state;
            return state === "in" || (state === "post" && Date.now() - new Date(e.date) < 8 * 60 * 60 * 1000);
          })
          .map((e) => String(e.id));
        if (!next) {
          els.banner.hidden = true;
          return { played, total: events.length, liveIds };
        }
        const competitors = next.competitions[0].competitors || [];
        const opponent = competitors.find((c) => String(c.team?.id) !== TEAM_ID)?.team;
        const home = competitors.find((c) => String(c.team?.id) === TEAM_ID)?.homeAway === "home";
        const live = next.competitions[0].status?.type?.state === "in";
        const when = formatDate(next.date, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        const matchup = `${home ? "vs." : "@"} ${opponent?.displayName || "TBD"}`;
        els.banner.textContent = live
          ? `Live now: Spurs ${matchup}`
          : played === 0
            ? `${seasonLabel(season)} tips off ${when} ${matchup}`
            : `Next game: ${when} ${matchup}`;
        els.banner.hidden = false;
        return { played, total: events.length, liveIds };
      }

      // ---- Projection chart ---------------------------------------------

      function buildProjection(careerBlocks, careerBpg, season, progress) {
        const seasonFraction = progress?.total ? Math.max(0, 1 - progress.played / progress.total) : 1;
        const points = [{ season: season - 1, label: "Now", values: SCENARIOS.map(() => careerBlocks) }];
        const running = SCENARIOS.map(() => careerBlocks);
        for (let year = season; year <= FINAL_SEASON; year += 1) {
          SCENARIOS.forEach((s, i) => {
            const declineYears = s.decline ? Math.max(0, year - DECLINE_STARTS + 1) : 0;
            const perSeason = careerBpg * s.bpgScale * s.games * Math.pow(1 - s.decline, declineYears);
            running[i] += perSeason * (year === season ? seasonFraction : 1);
          });
          points.push({ season: year, label: seasonLabel(year), values: running.map(Math.round) });
        }
        return points;
      }

      function svgEl(tag, attrs = {}, text) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
        if (text != null) node.textContent = text;
        return node;
      }

      function renderProjection(careerBlocks, careerBpg, season, progress) {
        const points = buildProjection(careerBlocks, careerBpg, season, progress);
        lastProjectionArgs = [careerBlocks, careerBpg, season, progress];
        // Size the coordinate space to the container so text stays legible on phones.
        const W = Math.max(320, Math.min(680, els.projectionChart.clientWidth || 680));
        const H = W < 500 ? 260 : 300;
        const pad = { top: 16, right: W < 500 ? 84 : 96, bottom: 30, left: 40 };
        const maxY = Math.max(4500, ...points.flatMap((p) => p.values));
        const yMax = Math.ceil(maxY / 1000) * 1000;
        const x = (i) => pad.left + (i / (points.length - 1)) * (W - pad.left - pad.right);
        const y = (v) => pad.top + (1 - v / yMax) * (H - pad.top - pad.bottom);

        const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Projected career blocks by season under three scenarios, compared to the 3,830 record" });
        for (let v = 0; v <= yMax; v += 1000) {
          svg.append(svgEl("line", { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: "grid-line" }));
          svg.append(svgEl("text", { x: pad.left - 8, y: y(v) + 4, class: "axis-label", "text-anchor": "end" }, v ? `${v / 1000}k` : "0"));
        }
        points.forEach((p, i) => {
          if (i % (W < 500 ? 3 : 2) === 0 || i === points.length - 1) {
            svg.append(svgEl("text", { x: x(i), y: H - 8, class: "axis-label", "text-anchor": "middle" }, i === 0 ? "Now" : `’${String(p.season).slice(-2)}`));
          }
        });
        svg.append(svgEl("line", { x1: pad.left, x2: W - pad.right, y1: y(RECORD), y2: y(RECORD), class: "record-line" }));
        svg.append(svgEl("text", { x: pad.left + 6, y: y(RECORD) - 6, class: "record-label" }, "Hakeem Olajuwon's record · 3,830"));

        const endLabels = SCENARIOS.map((s, i) => ({ s, value: points.at(-1).values[i] }));
        SCENARIOS.forEach((s, i) => {
          const d = points.map((p, j) => `${j ? "L" : "M"}${x(j).toFixed(1)},${y(p.values[i]).toFixed(1)}`).join(" ");
          svg.append(svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-dasharray": s.dash, "stroke-linejoin": "round", "stroke-linecap": "round" }));
        });
        // Direct labels at line ends, nudged apart so they never overlap.
        const placed = endLabels.map((l) => ({ ...l, y: y(l.value) })).sort((a, b) => a.y - b.y);
        for (let i = 1; i < placed.length; i += 1) {
          placed[i].y = Math.max(placed[i].y, placed[i - 1].y + 14);
        }
        placed.forEach((l) => {
          svg.append(svgEl("text", { x: W - pad.right + 6, y: l.y + 4, class: "end-label" }, `${l.s.label} ${fmtNumber(l.value)}`));
        });

        const cursor = svgEl("line", { y1: pad.top, y2: H - pad.bottom, class: "cursor-line", visibility: "hidden" });
        const dots = SCENARIOS.map((s) => svgEl("circle", { r: 4, fill: s.color, stroke: "var(--panel-solid)", "stroke-width": 2, visibility: "hidden" }));
        svg.append(cursor, ...dots);
        const hit = svgEl("rect", { x: pad.left, y: pad.top, width: W - pad.left - pad.right, height: H - pad.top - pad.bottom, fill: "transparent" });
        svg.append(hit);

        const tooltip = els.projectionTooltip;
        function show(event) {
          const rect = svg.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          const i = Math.max(0, Math.min(points.length - 1, Math.round(((px - pad.left) / (W - pad.left - pad.right)) * (points.length - 1))));
          const p = points[i];
          cursor.setAttribute("x1", x(i));
          cursor.setAttribute("x2", x(i));
          cursor.setAttribute("visibility", "visible");
          dots.forEach((dot, k) => {
            dot.setAttribute("cx", x(i));
            dot.setAttribute("cy", y(p.values[k]));
            dot.setAttribute("visibility", "visible");
          });
          tooltip.innerHTML = `<strong>${i === 0 ? "Today" : `End of ${p.label}`}</strong>` +
            SCENARIOS.map((s, k) => `<span><i style="background:${s.color}"></i>${s.label}<b>${fmtNumber(p.values[k])}</b></span>`).join("");
          tooltip.hidden = false;
          const host = els.projectionChart.getBoundingClientRect();
          const left = (x(i) / W) * host.width;
          tooltip.style.left = `${Math.min(Math.max(left, 70), host.width - 70)}px`;
        }
        function hide() {
          cursor.setAttribute("visibility", "hidden");
          dots.forEach((dot) => dot.setAttribute("visibility", "hidden"));
          tooltip.hidden = true;
        }
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("pointerleave", hide);
        els.projectionChart.replaceChildren(svg);

        els.projectionLegend.innerHTML = SCENARIOS
          .map((s) => `<li><svg width="22" height="8" aria-hidden="true"><line x1="1" x2="21" y1="4" y2="4" stroke="${s.color}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linecap="round"/></svg>${s.label}</li>`)
          .join("") + `<li><svg width="22" height="8" aria-hidden="true"><line x1="1" x2="21" y1="4" y2="4" class="record-line"/></svg>Record</li>`;

        els.projectionSummary.innerHTML = SCENARIOS
          .map((s, i) => {
            const pass = points.find((p) => p.values[i] > RECORD);
            const end = points.at(-1).values[i];
            return `<li><strong style="--swatch:${s.color}">${s.label}</strong> ${pass
              ? `breaks the record in ${pass.label}`
              : `finishes ${fmtNumber(RECORD - end + 1)} short`}</li>`;
          })
          .join("");

        els.projectionTable.innerHTML = points
          .map((p, i) => `<tr><td>${i === 0 ? "Today" : p.label}</td>${p.values.map((v) => `<td class="num">${fmtNumber(v)}</td>`).join("")}</tr>`)
          .join("");

        els.projectionNote.textContent =
          `Through his age-36 season (${seasonLabel(FINAL_SEASON)}). High: ${fmtDecimal(careerBpg)} blocks per game (career rate) over 72 games a season. ` +
          `Mid: same rate over 65 games, falling 4% a year from ${seasonLabel(DECLINE_STARTS)}. ` +
          `Conservative: 75% of his career rate over 60 games.`;
      }

      // ---- Load -----------------------------------------------------------

      function clearError() {
        els.error.hidden = true;
        els.error.textContent = "";
      }

      function showError(message) {
        els.error.textContent = message;
        els.error.hidden = false;
      }

      let gameState = null;
      let liveTimer = null;
      const LIVE_REFRESH_MS = 30 * 1000;

      function renderGameState() {
        const state = gameState;
        const currentGames = state.currentGames ? mergeLiveGames(state.currentGames, state.liveGames) : null;
        const previousGames = state.previousGames;
        const season = state.season;

        const currentBlocks = (currentGames || [])
          .filter((g) => g.type === "regular")
          .reduce((sum, g) => sum + g.blocks, 0);
        const computed = state.priorBlocks != null && currentGames ? state.priorBlocks + currentBlocks : null;
        // Use whichever source is further along; the core total can trail by 15+ minutes.
        const careerBlocks = Math.max(state.coreCareer ?? -1, computed ?? -1);
        if (careerBlocks < 0) throw new Error("Career blocks unavailable");
        const careerBpg = state.careerBpg ??
          (state.careerGames ? careerBlocks / state.careerGames : null);

        renderChase(careerBlocks);
        els.careerBpg.textContent = fmtDecimal(careerBpg);
        els.careerGames.textContent = state.careerGames == null ? "--" : `${fmtNumber(state.careerGames)} games`;
        renderMilestones(careerBlocks, careerBpg);
        renderAllTime(careerBlocks);
        if (careerBpg) renderProjection(careerBlocks, careerBpg, season, state.progress);

        // Before the new season's first game, the log and season stats show last season.
        const seasonGames = currentGames?.some((g) => g.type === "regular") ? currentGames : previousGames || [];
        const activeSeason = seasonGames === currentGames ? season : season - 1;
        const regular = seasonGames.filter((g) => g.type === "regular");
        const streakGames = [
          ...regular,
          ...(seasonGames === currentGames ? (previousGames || []).filter((g) => g.type === "regular") : []),
        ];
        latestGames = regular;
        els.gameLogSeason.textContent = seasonLabel(activeSeason);
        renderGameLog();
        renderStreak(streakGames);
        renderLastGame([...(currentGames || []), ...(previousGames || [])]
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0]);

        const seasonBlocks = regular.reduce((sum, g) => sum + g.blocks, 0);
        els.seasonKpiLabel.textContent = activeSeason === season ? "This season" : seasonLabel(activeSeason);
        els.seasonBpgLabel.textContent = `${seasonLabel(activeSeason)} per game`;
        els.seasonBlocks.textContent = fmtNumber(seasonBlocks);
        els.seasonGames.textContent = `${fmtNumber(regular.length)} ${regular.length === 1 ? "game" : "games"}`;
        els.seasonBpg.textContent = regular.length ? fmtDecimal(seasonBlocks / regular.length) : "--";
        return { activeSeason };
      }

      // While a Spurs game is live, re-read only its box score every 30 seconds.
      function scheduleLiveRefresh() {
        window.clearTimeout(liveTimer);
        if (!gameState?.liveGames.some((g) => g.live)) return;
        liveTimer = window.setTimeout(async () => {
          if (document.visibilityState === "visible" && !loading) {
            const liveGames = await loadLiveGames(gameState.liveIds, gameState.season);
            if (liveGames.length) gameState.liveGames = liveGames;
            try {
              renderGameState();
              lastLoadedAt = new Date();
            } catch (error) {
              console.error(error);
            }
          }
          scheduleLiveRefresh();
        }, LIVE_REFRESH_MS);
      }

      async function loadData() {
        if (loading) return;
        loading = true;
        clearError();
        els.status.textContent = "Loading...";
        els.refreshButton.disabled = true;
        const failures = [];
        const attempt = async (label, task) => {
          try {
            return await task();
          } catch (error) {
            console.error(label, error);
            failures.push(label);
            return null;
          }
        };

        try {
          const season = currentSeasonYear();

          const [career, yearByYear, profile, currentGames, previousGames, progress] = await Promise.all([
            attempt("career", () => fetchJson(`${ESPN_CORE}/athletes/${ATHLETE_ID}/statistics/0`)),
            attempt("by season", () => fetchJson(`${ESPN_WEB}/athletes/${ATHLETE_ID}/stats`)),
            attempt("profile", () => fetchCached(`${ESPN_CORE}/athletes/${ATHLETE_ID}`, 24 * 60 * 60 * 1000)),
            attempt("game log", () => loadSeasonGames(season, true)),
            attempt("game log", () => loadSeasonGames(season - 1, false)),
            attempt("schedule", () => renderBanner(season)),
          ]);

          let byYearRows = null;
          if (yearByYear) {
            byYearRows = await attempt("by season", () => renderByYear(yearByYear));
          } else {
            els.byYear.innerHTML = `<tr><td colspan="4" class="empty">No data.</td></tr>`;
          }
          if (profile) {
            els.playerAge.textContent = profile.age ?? "--";
            els.playerTeam.textContent = `#${profile.jersey ?? "1"} · San Antonio Spurs`;
          }

          const liveIds = progress?.liveIds || [];
          gameState = {
            season,
            progress,
            coreCareer: coreStat(career, "defensive", "blocks"),
            careerGames: coreStat(career, "general", "gamesPlayed"),
            careerBpg: coreStat(career, "defensive", "avgBlocks"),
            // Finished seasons from the by-season table; the current season is counted game by game.
            priorBlocks: byYearRows
              ? byYearRows.filter((r) => r.year && r.year < season).reduce((sum, r) => sum + r.blocks, 0)
              : null,
            currentGames,
            previousGames,
            liveIds,
            liveGames: await loadLiveGames(liveIds, season),
          };
          const { activeSeason } = renderGameState();
          scheduleLiveRefresh();

          const leaders = await attempt("leaders", () => renderSeasonLeaders(activeSeason));
          const rank = leaders?.season === activeSeason ? leaders.rank : null;
          els.seasonRank.textContent = rank ? `#${rank} in the NBA` : "--";
          if (!leaders) els.seasonLeaders.innerHTML = `<li class="empty">No data.</li>`;

          lastLoadedAt = new Date();
          els.status.textContent = `Updated ${timeAgoLabel(lastLoadedAt)}`;
          if (failures.length) {
            showError(`Some ESPN data did not load (${[...new Set(failures)].join(", ")}). Retrying on the next refresh.`);
          }
        } catch (error) {
          console.error(error);
          showError("ESPN data unavailable. Retrying shortly.");
          els.status.textContent = "Load failed";
        } finally {
          els.refreshButton.disabled = false;
          loading = false;
        }
      }

      function scheduleAutoRefresh() {
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = window.setInterval(() => {
          if (document.visibilityState === "visible") loadData();
        }, AUTO_REFRESH_MS);

        if (statusTimer) window.clearInterval(statusTimer);
        statusTimer = window.setInterval(() => {
          if (lastLoadedAt && !loading) {
            els.status.textContent = `Updated ${timeAgoLabel(lastLoadedAt)}`;
          }
        }, 1000);
      }

      els.refreshButton.addEventListener("click", () => loadData());

      els.gameLogToggle.addEventListener("click", () => {
        showFullLog = !showFullLog;
        renderGameLog();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && lastLoadedAt) {
          const minutesSince = (Date.now() - lastLoadedAt.getTime()) / 60000;
          if (minutesSince >= 4) loadData();
        }
      });

      let resizeFrame = null;
      window.addEventListener("resize", () => {
        if (!lastProjectionArgs) return;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => renderProjection(...lastProjectionArgs));
      });

      // In-page links scroll to their section without adding #section to the URL.
      document.addEventListener("click", (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        const target = document.getElementById(link.getAttribute("href").slice(1));
        if (!target) return;
        event.preventDefault();
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        if (!target.matches("a, button, input, [tabindex]")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
      if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      scheduleAutoRefresh();
      loadData();
