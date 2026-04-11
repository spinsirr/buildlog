# BuildLog Agent Harness Report

- Mode: mocked
- Passed: 6/6
- Failed: 0
- Posted: 1
- Skipped: 1
- Bundle later: 3
- Errors: 1

## bundle-later-feature-prep
- Expected: bundle_later
- Actual: bundle_later
- Passed: yes
- Explanation: Decision matched expected outcome (bundle_later). All harness checks passed. Agent reasoning: This refactor matters, but the story is incomplete on its own. Better to bundle it with the related user-facing work.
- Steps: 4
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence
  - ✅ skip_no_content

## bundle-later-incremental-feature
- Expected: bundle_later
- Actual: bundle_later
- Passed: yes
- Explanation: Decision matched expected outcome (bundle_later). All harness checks passed. Agent reasoning: This refactor matters, but the story is incomplete on its own. Better to bundle it with the related user-facing work.
- Steps: 4
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence
  - ✅ skip_no_content

## bundle-later-refactor
- Expected: bundle_later
- Actual: bundle_later
- Passed: yes
- Explanation: Decision matched expected outcome (bundle_later). All harness checks passed. Agent reasoning: This refactor matters, but the story is incomplete on its own. Better to bundle it with the related user-facing work.
- Steps: 4
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence
  - ✅ skip_no_content

## error-garbage-model
- Expected: error
- Actual: error
- Passed: yes
- Explanation: Decision matched expected outcome (error). All harness checks passed. Agent reasoning: Agent error: No object generated: could not parse the response.
- Steps: 0
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence

## post-feature
- Expected: post
- Actual: post
- Passed: yes
- Explanation: Decision matched expected outcome (post). All harness checks passed. Agent reasoning: Mock reasoning: analyzed the event and decided to post.
- Angle: harness-generated angle
- Content preview: Harness generated a valid post. #buildinpublic
- Content length: 46
- Steps: 4
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence
  - ✅ has_content
  - ✅ has_angle
  - ✅ content_length
  - ✅ no_exposed_paths
  - ✅ no_exposed_functions
  - ✅ has_hashtags

## skip-lint
- Expected: skip
- Actual: skip
- Passed: yes
- Explanation: Decision matched expected outcome (skip). All harness checks passed. Agent reasoning: Mock reasoning: analyzed the event and decided to skip.
- Steps: 4
- All checks:
  - ✅ decision_accuracy
  - ✅ valid_decision
  - ✅ has_reasoning
  - ✅ valid_confidence
  - ✅ skip_no_content
