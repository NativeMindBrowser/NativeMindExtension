import { TagBuilder } from '@/utils/prompts/helpers'

export const AGENT_INITIAL_GUIDANCE = new TagBuilder('initial_guidance').insertContent(`Remember to analyze what information layer this question requires:
- Layer 0 (Surface): Immediately visible information
- Layer 1 (Interactive): Information behind clicks and expansions  
- Layer 2 (External): Information from other sources

Most detailed questions require Layer 1 information. Surface information is rarely sufficient.`)

export const AGENT_CHECKPOINT_MESSAGES: Record<number, TagBuilder> = {
  2: new TagBuilder('checkpoint_1').insertContent(`FIRST ACTION COMPLETE. Now assess your progress:
- Did you identify where the detailed information lives on this page?
- Can you see clickable elements that lead to the information the user needs?
- If yes to both: Your next 2-3 actions should be clicking those elements.
- If no: You may need to look elsewhere or search online.

Remember: Surface viewing (Layer 0) is just the beginning, not the end.
Most user questions require Layer 1 information behind clicks.`),

  4: new TagBuilder('checkpoint_3').insertContent(`THIRD ITERATION. Progress check:
- Have you moved from surface (Layer 0) to deep (Layer 1) information?
- Are you clicking on information-rich elements or just browsing around?
- Is your information getting more complete or are you wandering aimlessly?

Critical reminder: If user asked about specific content (comments, details, analysis), 
you MUST access that actual content, not just see that it exists.
Click on relevant elements that contain the information needed.`),

  6: new TagBuilder('checkpoint_5').insertContent(`FIFTH ITERATION. Strategy review:
- List what concrete information you've learned so far
- List what you still don't know but need to know
- If gaps remain, identify exactly which elements to click next
- If information is complete, prepare to provide your final answer

Key question: Can you fully answer the user's question with your current information?
If NO: Continue clicking on relevant elements. If YES: Provide comprehensive answer.`),

  8: new TagBuilder('checkpoint_7').insertContent(`APPROACHING ITERATION LIMIT. Final push needed:
- You have only 3 more attempts remaining
- Focus on the most critical missing information gaps
- Click on the most promising unexplored elements that likely contain needed info
- After 2 more iterations, you must provide the best answer possible with available data

Stop exploring only if: no more relevant clickable elements OR information is truly complete.`),
}

export const AGENT_TOOL_CALL_RESULT_GUIDANCE = `Based on the tool results above, follow your self-assessment protocol:

- Analyze the results before taking further action.
- Evaluate what you have learned and identify any remaining gaps.
- Proceed with the next steps based on your assessment of information completeness.`

export const AGENT_FORCE_FINAL_ANSWER = `Answer Language: Strictly follow the LANGUAGE POLICY above.\nBased on all the information collected above, please provide a comprehensive final answer.\nDo not use any tools.`
