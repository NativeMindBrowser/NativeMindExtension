import { TagBuilder } from '@/utils/prompts/helpers'

export const AGENT_INITIAL_GUIDANCE = new TagBuilder('initial_guidance').insertContent(`Remember to analyze what information layer this question requires:
- Layer 0 (Surface): Immediately visible information
- Layer 1 (Interactive): Information behind clicks and expansions  
- Layer 2 (External): Information from other sources

Most detailed questions require Layer 1 information. Surface information is rarely sufficient.`)

export const AGENT_TOOL_CALL_RESULT_GUIDANCE = `Based on the tool results above, follow your self-assessment protocol:

- Analyze the results before taking further action.
- Evaluate what you have learned and identify any remaining gaps.
- Proceed with the next steps based on your assessment of information completeness.`

export const AGENT_FORCE_FINAL_ANSWER = `Answer Language: Strictly follow the LANGUAGE POLICY above.\nBased on all the information collected above, please provide a comprehensive final answer.\nDo not use any tools.`
