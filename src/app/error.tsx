"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("An application error occurred", { digest: error.digest }); }, [error]);
  return <div className="page"><h1>Something went wrong</h1><p className="lede">Your local data was not changed. Try the action again.</p><button onClick={reset}>Try again</button></div>;
}
