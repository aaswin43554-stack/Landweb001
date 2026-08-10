import { parseCommentsFromDescription, mergeComments, mergeDisputeStates, type CRDTState, type CRDTComment } from '../src/lib/crdt'

function runTests() {
  console.log('🧪 Running CRDT Synchronization Engine Tests...\n')
  let passes = 0
  let fails = 0

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`)
      passes++
    } else {
      console.error(`❌ FAIL: ${message}`)
      fails++
    }
  }

  // Test 1: Comments Parsing
  try {
    const desc = 'Boundary problem — Fence moved by 1.5m \n[Officer Remark: Boundary verified via GPS walk] \n[Officer Remark: Second check approved]'
    const comments = parseCommentsFromDescription(desc)
    assert(comments.length === 2, 'Should parse exactly two officer remarks from description string')
    assert(comments[0].text === 'Boundary verified via GPS walk', 'Should parse first remark text correctly')
    assert(comments[1].text === 'Second check approved', 'Should parse second remark text correctly')
  } catch (err: any) {
    assert(false, `Test 1 threw error: ${err.message}`)
  }

  // Test 2: Comments Merging (Union and Chronological Sorting)
  try {
    const localComments: CRDTComment[] = [
      { id: 'c1', author: 'Officer A', text: 'Spoke with neighbor A', timestamp: 1000 },
      { id: 'c2', author: 'Officer A', text: 'Checked deeds', timestamp: 2000 }
    ]
    const remoteComments: CRDTComment[] = [
      { id: 'c2', author: 'Officer A', text: 'Checked deeds (updated)', timestamp: 2500 }, // Overwrite
      { id: 'c3', author: 'Officer B', text: 'Neighbor B agreed to walk', timestamp: 3000 } // New
    ]

    const merged = mergeComments(localComments, remoteComments)
    assert(merged.length === 3, 'Merged comments should have exactly three items')
    assert(merged[0].id === 'c1', 'First sorted comment should be c1')
    assert(merged[1].id === 'c2' && merged[1].text === 'Checked deeds (updated)', 'c2 should be updated by newer remote timestamp')
    assert(merged[2].id === 'c3', 'Last sorted comment should be c3')
  } catch (err: any) {
    assert(false, `Test 2 threw error: ${err.message}`)
  }

  // Test 3: Last-Write-Wins (LWW) Register Merging for Status
  try {
    const localState: CRDTState = {
      disputeId: 'dsp-001',
      status: { value: 'in_review', timestamp: 5000 },
      comments: []
    }
    const remoteState: CRDTState = {
      disputeId: 'dsp-001',
      status: { value: 'resolved', timestamp: 6000 }, // Newer
      comments: []
    }

    const merged = mergeDisputeStates(localState, remoteState)
    assert(merged.status.value === 'resolved', 'Status should be resolved due to newer timestamp (LWW)')

    const staleRemoteState: CRDTState = {
      disputeId: 'dsp-001',
      status: { value: 'submitted', timestamp: 4000 }, // Older
      comments: []
    }
    const mergedStale = mergeDisputeStates(localState, staleRemoteState)
    assert(mergedStale.status.value === 'in_review', 'Status should remain in_review if remote update is older')
  } catch (err: any) {
    assert(false, `Test 3 threw error: ${err.message}`)
  }

  console.log(`\n📊 Test Summary: ${passes} passed, ${fails} failed.`)
  process.exit(fails === 0 ? 0 : 1)
}

runTests()
