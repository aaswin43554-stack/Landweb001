/**
 * Conflict-Free Replicated Data Type (CRDT) utilities for offline-first dispute resolution.
 * Uses LWW-Register (Last-Write-Wins) for status and G-Set/Union sets for comments logs
 * to ensure that when two officer tablets sync, all comments are preserved and the latest
 * status resolves deterministically.
 */

export type CRDTComment = {
  id: string
  author: string
  text: string
  timestamp: number
}

export type CRDTState = {
  disputeId: string
  status: {
    value: 'submitted' | 'in_review' | 'resolved'
    timestamp: number
  }
  comments: CRDTComment[]
  geoCoords?: {
    value: { lat: number; lng: number }[]
    timestamp: number
  }
}

/**
 * Parses the comments/remarks from a dispute description string.
 * Description format: "Category - Notes \n[Officer Remark: text] \n[Officer Comment: text]"
 */
export function parseCommentsFromDescription(description: string | null): CRDTComment[] {
  if (!description) return []
  const comments: CRDTComment[] = []
  
  // Extract officer comments from formatting like "[Officer Remark: text]" or similar
  const remarkRegex = /\[Officer Remark:\s*([^\]]+)\]/gi
  let match
  let index = 0
  
  while ((match = remarkRegex.exec(description)) !== null) {
    comments.push({
      id: `remark-${index}-${match[1].substring(0, 10).replace(/\s+/g, '')}`,
      author: 'Field Officer',
      text: match[1].trim(),
      timestamp: Date.now() - 3600000 + index * 60000, // Simulated past timestamps
    })
    index++
  }

  // Also look for standard custom CRDT comments structured in JSON or block remarks
  const crdtCommentRegex = /\[CRDT-Comment\s+([0-9a-f-]+)\s+([^:]+):\s*([^\]]+)\]/gi
  while ((match = crdtCommentRegex.exec(description)) !== null) {
    const timestampStr = match[1] // Can represent the timestamp/id
    comments.push({
      id: match[1],
      author: match[2].trim(),
      text: match[3].trim(),
      timestamp: parseInt(timestampStr, 10) || Date.now(),
    })
  }

  return comments
}

/**
 * Merges two collections of CRDTComments by taking the union,
 * deduplicating by ID, and sorting chronologically.
 */
export function mergeComments(local: CRDTComment[], remote: CRDTComment[]): CRDTComment[] {
  const mergedMap = new Map<string, CRDTComment>()
  
  // Add local comments
  for (const c of local) {
    mergedMap.set(c.id, c)
  }
  
  // Add remote comments (will overwrite if duplicate ID exists, maintaining consistency)
  for (const c of remote) {
    const existing = mergedMap.get(c.id)
    if (!existing || c.timestamp > existing.timestamp) {
      mergedMap.set(c.id, c)
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Merges two dispute states deterministically using CRDT logic:
 * 1. Status is resolved via Last-Write-Wins (LWW).
 * 2. Comments logs are merged via Grow-Only Set Union.
 * 3. Geometry updates are resolved via LWW.
 */
export function mergeDisputeStates(local: CRDTState, remote: CRDTState): CRDTState {
  // 1. Status LWW merge
  const status = local.status.timestamp >= remote.status.timestamp ? local.status : remote.status

  // 2. Comments union
  const comments = mergeComments(local.comments, remote.comments)

  // 3. GeoCoords LWW merge
  let geoCoords = local.geoCoords
  if (remote.geoCoords) {
    if (!local.geoCoords || remote.geoCoords.timestamp > local.geoCoords.timestamp) {
      geoCoords = remote.geoCoords
    }
  }

  return {
    disputeId: local.disputeId,
    status,
    comments,
    geoCoords,
  }
}

/**
 * Converts a merged CRDTState back into standard dispute values.
 */
export function formatMergedDescription(baseNote: string, comments: CRDTComment[]): string {
  let description = baseNote
  
  for (const comment of comments) {
    description += ` \n[Officer Remark: ${comment.text}]`
  }
  
  return description
}
