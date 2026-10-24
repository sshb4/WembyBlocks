# Wemby Blocks

A higher standard.

Follow Victor Wembanyama's chase of Hakeem Olajuwon's all-time NBA blocks record (3,830) at **[wembyblocks.com](https://wembyblocks.com)**.

## What you can see

- His career block total, counted against the record.
- His current streak of games with a block.
- His last game, the game log, and his stats by season.
- Next milestones, including each all-time great he passes.
- A career projection under high, mid, and conservative scenarios.
- The all-time and current-season blocks leaderboards, plus Spurs news.

The stats are open to everyone. No account, phone number, or text subscription is needed.

## Data

Stats come from ESPN's public NBA endpoints, called straight from the browser (they allow cross-origin requests; no key). The page refreshes every five minutes.

| Purpose | Endpoint |
|---|---|
| Career total (hero number) | `sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/5104157/statistics/0` |
| Stats by season | `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/5104157/stats` |
| Game log | `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/5104157/gamelog?season=YYYY` |
| Schedule / next game | `site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/24/schedule?season=YYYY&seasontype=2` |
| Blocks per game leaders | `sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/YYYY/types/2/leaders` |
| Spurs news | `site.api.espn.com/apis/site/v2/sports/basketball/nba/news?team=24` |

ESPN labels a season by the year it ends (2026-27 is `2027`). Until the new season's first regular-season game, the game log, streak, and season stats show the previous season; the streak carries across seasons. The gamelog's regular-season section includes All-Star and NBA Cup Championship games, which are filtered out so totals match ESPN's season stats.

Run locally with any static server, for example `python3 -m http.server`, then open http://localhost:8000.

## Block texts

Optional SMS alerts (one text per regular-season block) run on a separate Cloudflare Worker in [`notifications/`](notifications/README.md). Pre-launch signup is open: the form saves consent in D1 without sending a text. Alerts remain disabled; activation requires a confirmation text and YES reply at launch.

## Questions?

Contact [sashacbates@gmail.com](mailto:sashacbates@gmail.com).

Read the [SMS terms](https://wembyblocks.com/sms-terms/) and [SMS privacy notice](https://wembyblocks.com/sms-privacy/).

Wemby Blocks is an independent fan project and is not affiliated with the NBA, the San Antonio Spurs, or Victor Wembanyama.
