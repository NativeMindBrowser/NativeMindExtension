import { describe, expect, it } from 'vitest'

import { markdownSectionDiff } from './diff'

describe('markdownSectionDiff', () => {
  it('should generate diff for simple text changes - entire section in one tag', () => {
    const left = `# Title

Original paragraph.`

    const right = `# Title

Modified paragraph.`

    const result = markdownSectionDiff(left, right)

    // Entire section should be in one del/ins tag
    expect(result).toContain('<delete>Title\n\nOriginal paragraph.</delete>')
    expect(result).toContain('<insert>Title\n\nModified paragraph.</insert>')
  })

  it('should handle additions - entire section in one tag', () => {
    const left = `# Title

First paragraph.`

    const right = `# Title

First paragraph.

Second paragraph.`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each
    expect(result).toContain('<delete>Title\n\nFirst paragraph.</delete>')
    expect(result).toContain('<insert>Title\n\nFirst paragraph.\n\nSecond paragraph.</insert>')
  })

  it('should handle deletions - entire section in one tag', () => {
    const left = `# Title

First paragraph.

Second paragraph.`

    const right = `# Title

First paragraph.`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each
    expect(result).toContain('<delete>Title\n\nFirst paragraph.\n\nSecond paragraph.</delete>')
    expect(result).toContain('<insert>Title\n\nFirst paragraph.</insert>')
  })

  it('should handle empty documents', () => {
    const left = ''
    const right = '# New Title'

    const result = markdownSectionDiff(left, right)

    expect(result).toContain('<insert>New Title</insert>')
  })

  it('should show diff markers for block-level changes - entire section in one tag', () => {
    const left = `# Original

This will be deleted.`

    const right = `# Original

This is new content.`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each
    expect(result).toContain('<delete>Original\n\nThis will be deleted.</delete>')
    expect(result).toContain('<insert>Original\n\nThis is new content.</insert>')
  })

  it('should diff entire sections when any content changes - entire section in one tag', () => {
    const left = `# Same Title

Unchanged paragraph.

Different paragraph.`

    const right = `# Same Title

Unchanged paragraph.

Modified paragraph.`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each
    expect(result).toContain('<delete>Same Title\n\nUnchanged paragraph.\n\nDifferent paragraph.</delete>')
    expect(result).toContain('<insert>Same Title\n\nUnchanged paragraph.\n\nModified paragraph.</insert>')
  })

  it('should treat entire heading section as atomic unit - entire section in one tag', () => {
    const left = `# Title with small change

Paragraph 1

Paragraph 2`

    const right = `# Title with SMALL change

Paragraph 1

Paragraph 2`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each
    expect(result).toContain('<delete>Title with small change\n\nParagraph 1\n\nParagraph 2</delete>')
    expect(result).toContain('<insert>Title with SMALL change\n\nParagraph 1\n\nParagraph 2</insert>')
  })

  it('should diff by heading sections - your example - entire section in one tag', () => {
    const left = `# A

this is content`

    const right = `# A

this is another content`

    const result = markdownSectionDiff(left, right)

    // Entire sections should be in one del/ins tag each - this is exactly your requirement!
    expect(result).toContain('<delete>A\n\nthis is content</delete>')
    expect(result).toContain('<insert>A\n\nthis is another content</insert>')
  })

  it('should handle multiple sections with different changes - entire section in one tag', () => {
    const left = `# Section 1

Content 1

# Section 2

Content 2

# Section 3

Content 3`

    const right = `# Section 1

Content 1

# Section 2

Modified content 2

# Section 3

Content 3`

    const result = markdownSectionDiff(left, right)

    // Only Section 2 should appear in diff (entire section in one tag each)
    expect(result).not.toContain('Section 1')
    expect(result).not.toContain('Section 3')
    expect(result).toContain('<delete>Section 2\n\nContent 2</delete>')
    expect(result).toContain('<insert>Section 2\n\nModified content 2</insert>')
  })

  it('should handle content without headings', () => {
    const left = `Content before heading

# Section 1

Content 1`

    const right = `Modified content before heading

# Section 1

Content 1`

    const result = markdownSectionDiff(left, right)

    // Should handle content before first heading as a section
    expect(result).toContain('<delete>Content before heading</delete>')
    expect(result).toContain('<insert>Modified content before heading</insert>')
    expect(result).not.toContain('Section 1')
    expect(result).not.toContain('Content 1')
  })

  it('should handle real page sample (nativemind.app faq)', () => {
    const left = `NativeMind: Your fully private, open-source, on-device AI assistant | NativeMind

Your AI.Your Data.

Zero Cloud.
=================================

By connecting to Ollama local LLMs, NativeMind delivers the latest AI capabilities right inside your favourite browser — without sending a single byte to cloud servers.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------

<button id="6">It's FreeAdd to Chrome</button>

Local by Nature.
----------------

Private by Default.
-------------------

### Absolute Privacy

100% on-device. No cloud. Your data never leaves your machine.

Fully open-source. Auditable, transparent, and community-backed.

### Enterprise Ready

Fast, local, and secure — built for real-world workflows.

### Why On-Device Matters?

Your data = your control: Everything runs locally — nothing is sent to the cloud.

No Sync, No Logs, No Leaks: NativeMind doesn't track, store, or transmit your data — ever.

### Run Powerful Open Models Locally, Seamlessly

Supports gpt-oss, DeepSeek, Qwen, Llama, Gemma, Mistral — fast, private, and fully on-device.

Seamless Ollama integration lets you load and switch models instantly, with no setup.

Everything You Need Inside Your Browser
---------------------------------------

### Summarize Webpages

Get clean, concise summaries of long articles or reports

### Chat Across Tabs

Ask questions and keep the context — even across different websites and pages.

### Local Web Search

Ask anything. NativeMind browses and answers directly in your browser.

### Translate Immersively

Instantly translate entire pages while keeping formatting intact. Context-aware and privacy-first.

### Use Local LLM in your Web App

Lightweight in-browser API to run prompts and get responses from your local LLM — no SDK, no server, fully controlled.

<a id="10">View API Docs ></a>

Pricing & Access
----------------

### Personal Use

No sign-up. No tracking. Just install and go.

100% Free

<button id="11">Add to Chrome</button>

Join the waitlist for updates on our upcoming enterprise solutions.

Join Now

Frequently Asked Questions
--------------------------

### <button id="12">Does NativeMind send any data to the cloud?</button>

No. NativeMind runs entirely on your local device. It doesn't send any of your data, prompts, or page content to external servers — ever. Everything stays on your machine.

### <button id="13">Is it really 100% offline?</button>

### <button id="14">Can I use my own models?</button>

### <button id="15">What browsers does it support?</button>

### <button id="16">What’s the minimal requirements of hardware? Do I need a GPU for this?</button>`

    const right = `NativeMind: Your fully private, open-source, on-device AI assistant | NativeMind

Your AI.Your Data.

Zero Cloud.
=================================

By connecting to Ollama local LLMs, NativeMind delivers the latest AI capabilities right inside your favourite browser — without sending a single byte to cloud servers.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------

<button id="6">It's FreeAdd to Chrome</button>

Local by Nature.
----------------

Private by Default.
-------------------

### Absolute Privacy

100% on-device. No cloud. Your data never leaves your machine.

Fully open-source. Auditable, transparent, and community-backed.

### Enterprise Ready

Fast, local, and secure — built for real-world workflows.

### Why On-Device Matters?

Your data = your control: Everything runs locally — nothing is sent to the cloud.

No Sync, No Logs, No Leaks: NativeMind doesn't track, store, or transmit your data — ever.

### Run Powerful Open Models Locally, Seamlessly

Supports gpt-oss, DeepSeek, Qwen, Llama, Gemma, Mistral — fast, private, and fully on-device.

Seamless Ollama integration lets you load and switch models instantly, with no setup.

Everything You Need Inside Your Browser
---------------------------------------

### Summarize Webpages

Get clean, concise summaries of long articles or reports

### Chat Across Tabs

Ask questions and keep the context — even across different websites and pages.

### Local Web Search

Ask anything. NativeMind browses and answers directly in your browser.

### Translate Immersively

Instantly translate entire pages while keeping formatting intact. Context-aware and privacy-first.

### Use Local LLM in your Web App

Lightweight in-browser API to run prompts and get responses from your local LLM — no SDK, no server, fully controlled.

<a id="10">View API Docs ></a>

Pricing & Access
----------------

### Personal Use

No sign-up. No tracking. Just install and go.

100% Free

<button id="11">Add to Chrome</button>

Join the waitlist for updates on our upcoming enterprise solutions.

Join Now

Frequently Asked Questions
--------------------------

### <button id="12">Does NativeMind send any data to the cloud?</button>

### <button id="13">Is it really 100% offline?</button>

Yes — all AI processing happens locally on your device. Even when you perform a web search, NativeMind opens tabs in your browser and extracts content directly — without sending your data to any remote APIs or external servers. You stay in control, and your data never leaves your machine.

### <button id="14">Can I use my own models?</button>

### <button id="15">What browsers does it support?</button>

### <button id="16">What’s the minimal requirements of hardware? Do I need a GPU for this?</button>`

    const result = markdownSectionDiff(left, right)

    expect(result).toEqual(`<delete><button id="12">Does NativeMind send any data to the cloud?</button>

No. NativeMind runs entirely on your local device. It doesn't send any of your data, prompts, or page content to external servers — ever. Everything stays on your machine.</delete>

<insert><button id="12">Does NativeMind send any data to the cloud?</button></insert>

<delete><button id="13">Is it really 100% offline?</button></delete>

<insert><button id="13">Is it really 100% offline?</button>

Yes — all AI processing happens locally on your device. Even when you perform a web search, NativeMind opens tabs in your browser and extracts content directly — without sending your data to any remote APIs or external servers. You stay in control, and your data never leaves your machine.</insert>
`)
  })
})
