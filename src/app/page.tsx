import { Card } from "@/components/ui/card";

export default function Home() {
  return <div className="page"><div className="eyebrow">Monday · Local workspace</div><h1>Good morning.</h1><p className="lede">Your foundation is ready. Work views will come online in the next product phases.</p><div className="grid"><Card><span className="card-label">Today</span><h2>A clear place to start</h2><p>Tasks and priorities arrive in Phase 2.</p></Card><Card><span className="card-label">System</span><h2>Local-first by design</h2><p>Application data stays in SQLite on this device.</p></Card><Card><span className="card-label">Activity</span><h2>History is durable</h2><p>Meaningful changes will flow through services and immutable events.</p></Card></div></div>;
}
