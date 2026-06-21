# 2️⃣ END-TO-END PIPELINE PSEUDOCODE (AUTHORITATIVE)

This is the **source of truth**.
Cursor should never contradict this logic.

```ts
for each competitorPage in activePages:
  result = firecrawl.fetch(competitorPage.url)

  if result.failed:
    log error
    continue

  normalized = normalize(result.rawText)
  newHash = hash(normalized)

  previousSnapshot = getLastSnapshot(competitorPage.id)

  if previousSnapshot exists:
    if newHash == previousSnapshot.hash:
      continue

    diff = diffEngine(previousSnapshot.normalizedText, normalized)

    if diff.isEmpty:
      continue

    meaningfulCheck = isMeaningful(diff)

    if meaningfulCheck.isMeaningful == false:
      saveSnapshot(newHash, normalized)
      continue

    insight = generateInsight(
      diff.oldSnippet,
      diff.newSnippet
    )

    saveAlert(
      competitorPage.id,
      diff,
      insight
    )

    sendEmail(
      user.email,
      insight
    )

  saveSnapshot(newHash, normalized)
```

**Golden rule:**

> Never alert unless `isMeaningful === true`