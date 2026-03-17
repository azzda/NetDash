# Features

## Topology graph

The graph canvas renders your network as a directed acyclic graph (DAG) laid out left-to-right by Dagre. Nodes never overlap; layout is recalculated on every snapshot update.

**Node types:**
- **Hardware** — physical routers, switches, firewalls, APs — rendered with a blue accent
- **Host** — virtual machines or bare-metal hosts — rendered with an emerald accent
- **Service** — software services running on a host — rendered with a violet accent

Each node card shows: name, IP address, status indicator (green = up, red = down).

## Traffic modes

Switch between three edge rendering modes in the graph toolbar or Settings drawer:

| Mode | Behaviour |
|---|---|
| **Off** | Straight unanimated lines — topology only |
| **Combined** | Straight lines with aggregate bandwidth label |
| **Bidirectional** | Two curved offset lanes, each with a directional traffic dot |

## Selection model

Click any node or connector to select it. Only one entity can be selected at a time.

- **Right panel** — switches to the appropriate inspector (node identity or connector endpoint metadata)
- **Bottom pane** — shows live metrics and logs for the selected entity
- **Click canvas background** — clears selection

## Scroll-driven observability expansion

When a node or connector is selected, scroll down past the graph. The graph compresses to a ~140 px strip (React Flow auto-fits the condensed view) and the sidebar hides, giving the observability pane the full viewport width.

In expanded mode:
- All metric series shown (not capped at 2)
- Up to 30 log entries visible (not capped at 8)
- Taller chart area (36 px height units vs 24)
- **Severity filter** buttons (All / Error / Warn / Info) appear above the search bar
- Log container scrolls without a height cap

Scroll back up to restore the default layout.

## Connection inspector

Selecting a connector shows a two-column **Side A / Side B** comparison card including:
- Human label and node identity
- Interface label and IP addresses
- Physical and logical port
- DNS names
- **Connector UUID** for cross-referencing with firewall rules
- Protocol and VLAN
- Policy reference tags (firewall, NAT, routing, ACL)

## Usage / pricing drawer

Click the cost figure in the title bar to open the usage drawer.

- **Simple view** — current estimated monthly cost and average power draw
- **Expanded view** — breakdown table with bucket allocations and an SVG cost history chart
- Updates every 4 seconds with a small random walk to simulate live data

## App info drawer

Click the **NetDash** title to open the app info drawer.

- Workspace version from `package.json`
- Manifest generation timestamp
- All workspace package versions
- Core service status rows (WebSocket broadcaster health, backend health, database placeholder)
- Auto-generated dependency groups from the build-time manifest

## Settings drawer

Click ⚙ to open Settings.

- **Profile** — avatar, display name, email, user ID badge, role badge; editable name and email fields
- **Appearance** — theme (System / Dark / Light) and density (Compact / Comfortable)
- **Traffic Visualization** — traffic mode selector with descriptions

Preferences are persisted to `localStorage` and restored on next load.

## WebSocket connection status

A small dot next to the NetDash title bar shows live backend connectivity:

| Colour | Meaning |
|---|---|
| 🟢 Green | Connected |
| 🟡 Amber (pulsing) | Reconnecting (exponential backoff) |
| 🔴 Red | Disconnected |

The client uses exponential backoff with jitter (up to 5 s). The backend pings each client every 30 s and terminates stale connections that do not respond with a pong.
