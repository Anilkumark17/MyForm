import { Graph, layout } from "@dagrejs/dagre"

import {
  branchRefs,
  canBranchFrom as canBranchFromQuestion,
  flowMemberIds,
  toggleFlowMember,
} from "@/lib/survey/conditional"
import { QUESTION_TYPE_MAP } from "@/lib/survey/question-types"
import {
  labeledAnswerOptions,
  type SurveyQuestion,
} from "@/lib/survey/questions"

export const QUESTION_NODE_WIDTH = 320
export const GROUP_NODE_WIDTH = 360
const GROUP_HEADER = 56
const GROUP_PAD = 16
const CHILD_GAP = 16
const OPTION_ROW_HEIGHT = 36
const QUESTION_NODE_HEADER = 104

const BRANCH_COLORS = [
  "#0f6e56",
  "#9a6700",
  "#1d4e89",
  "#b42318",
  "#3f6212",
  "#875c00",
]

export type FlowNodeKind = "question" | "questionGroup"

export type FlowGraphNode = {
  id: string
  type: FlowNodeKind
  position: { x: number; y: number }
  parentId?: string
  width: number
  height: number
  data: {
    questionId?: string
    groupId?: string
    index?: number
    prompt: string
    typeLabel?: string
    required?: boolean
    options: Array<{ id: string; label: string }>
    hasIncoming?: boolean
    memberCount?: number
  }
}

export type FlowGraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  kind: "branch" | "sequence"
  label?: string
  color: string
  optionId?: string
  sourceQuestionId: string
  targetQuestionId?: string
  targetGroupId?: string
}

export type FlowIssue = {
  severity: "error" | "warning" | "info"
  message: string
}

export type QuestionGroupInfo = {
  id: string
  name: string
  questionIds: string[]
  x: number
  y: number
}

export function optionHandleId(optionId: string) {
  return `option:${optionId}`
}

export function groupNodeId(groupId: string) {
  return `group:${groupId}`
}

export function isGroupNodeId(id: string) {
  return id.startsWith("group:")
}

export function parseGroupNodeId(id: string) {
  return isGroupNodeId(id) ? id.slice("group:".length) : null
}

export function branchColor(key: string) {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return BRANCH_COLORS[hash % BRANCH_COLORS.length]
}

export function estimateQuestionHeight(question: SurveyQuestion) {
  const options = Math.max(labeledAnswerOptions(question.options).length, 1)
  const mergeRow = labeledAnswerOptions(question.options).length > 0 ? OPTION_ROW_HEIGHT : 8
  return QUESTION_NODE_HEADER + options * OPTION_ROW_HEIGHT + mergeRow
}

export function listQuestionGroups(
  questions: SurveyQuestion[]
): QuestionGroupInfo[] {
  const map = new Map<string, QuestionGroupInfo>()
  for (const question of questions) {
    const id = question.config.groupId
    if (!id) continue
    const existing = map.get(id)
    if (existing) {
      existing.questionIds.push(question.id)
      if (question.config.groupName?.trim()) {
        existing.name = question.config.groupName.trim()
      }
      if (question.config.groupX != null) existing.x = question.config.groupX
      if (question.config.groupY != null) existing.y = question.config.groupY
    } else {
      map.set(id, {
        id,
        name: question.config.groupName?.trim() || "Question set",
        questionIds: [question.id],
        x: question.config.groupX ?? 0,
        y: question.config.groupY ?? 0,
      })
    }
  }
  return [...map.values()]
}

function groupHeight(memberCount: number, memberHeights: number[]) {
  const body = memberHeights.reduce((sum, height) => sum + height, 0)
  return GROUP_HEADER + GROUP_PAD + body + CHILD_GAP * Math.max(0, memberCount - 1) + GROUP_PAD
}

/** Questions that run when this answer is picked. */
export function collectBranchTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string
): string[] {
  return flowMemberIds(questions, sourceId, optionId)
}

/** A flow can only contain questions placed after its source. */
export function wouldCreateCycle(
  questions: SurveyQuestion[],
  sourceId: string,
  targetIds: string[]
): boolean {
  const sourceIndex = questions.findIndex((question) => question.id === sourceId)
  if (sourceIndex < 0 || targetIds.length === 0) return true
  return targetIds.some(
    (id) => questions.findIndex((question) => question.id === id) <= sourceIndex
  )
}

export function connectOptionToTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  targetIds: string[]
): SurveyQuestion[] {
  let next = questions
  for (const targetId of targetIds) {
    next = toggleFlowMember(next, sourceId, optionId, targetId, true)
  }
  return next
}

export function disconnectOptionFromTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  targetIds?: string[]
): SurveyQuestion[] {
  let next = questions
  for (const targetId of targetIds ??
    flowMemberIds(questions, sourceId, optionId)) {
    next = toggleFlowMember(next, sourceId, optionId, targetId, false)
  }
  return next
}

export function createQuestionGroup(
  questions: SurveyQuestion[],
  memberIds: string[],
  name: string
): SurveyQuestion[] {
  if (memberIds.length === 0) return questions
  const groupId = crypto.randomUUID()
  const members = new Set(memberIds)
  const ordered = questions.filter((question) => members.has(question.id))
  const first = ordered[0]
  const indexById = new Map(ordered.map((question, index) => [question.id, index]))
  return questions.map((question) => {
    if (!members.has(question.id)) return question
    const memberIndex = indexById.get(question.id) ?? 0
    let y = GROUP_HEADER
    for (let i = 0; i < memberIndex; i++) {
      y += estimateQuestionHeight(ordered[i]) + CHILD_GAP
    }
    return {
      ...question,
      config: {
        ...question.config,
        groupId,
        groupName: name.trim() || "Question set",
        groupX: first?.config.flowX ?? 80,
        groupY: first?.config.flowY ?? 80,
        flowX: GROUP_PAD,
        flowY: y,
      },
    }
  })
}

export function renameQuestionGroup(
  questions: SurveyQuestion[],
  groupId: string,
  name: string
): SurveyQuestion[] {
  const trimmed = name.trim() || "Question set"
  return questions.map((question) =>
    question.config.groupId === groupId
      ? {
          ...question,
          config: { ...question.config, groupName: trimmed },
        }
      : question
  )
}

export function removeFromGroup(
  questions: SurveyQuestion[],
  questionId: string
): SurveyQuestion[] {
  return questions.map((question) => {
    if (question.id !== questionId) return question
    return {
      ...question,
      config: {
        ...question.config,
        groupId: undefined,
        groupName: undefined,
        groupX: undefined,
        groupY: undefined,
        flowX: (question.config.groupX ?? 0) + (question.config.flowX ?? 0),
        flowY: (question.config.groupY ?? 0) + (question.config.flowY ?? 0),
      },
    }
  })
}

export function addQuestionsToGroup(
  questions: SurveyQuestion[],
  groupId: string,
  memberIds: string[]
): SurveyQuestion[] {
  const group = listQuestionGroups(questions).find((item) => item.id === groupId)
  if (!group) return questions
  const members = new Set(memberIds)
  return questions.map((question) => {
    if (!members.has(question.id)) return question
    return {
      ...question,
      config: {
        ...question.config,
        groupId,
        groupName: group.name,
        groupX: group.x,
        groupY: group.y,
        flowX: GROUP_PAD,
        flowY: GROUP_HEADER + group.questionIds.length * 120,
      },
    }
  })
}

export function applyNodePositions(
  questions: SurveyQuestion[],
  positions: Array<{
    id: string
    x: number
    y: number
    parentId?: string
  }>
): SurveyQuestion[] {
  const byId = new Map(positions.map((item) => [item.id, item]))
  const groups = listQuestionGroups(questions)

  return questions.map((question) => {
    const node = byId.get(question.id)
    const groupId = question.config.groupId
    const groupPos = groupId ? byId.get(groupNodeId(groupId)) : undefined
    const group = groups.find((item) => item.id === groupId)
    return {
      ...question,
      config: {
        ...question.config,
        flowX: node?.x ?? question.config.flowX,
        flowY: node?.y ?? question.config.flowY,
        groupX: groupPos?.x ?? group?.x ?? question.config.groupX,
        groupY: groupPos?.y ?? group?.y ?? question.config.groupY,
      },
    }
  })
}

export function layoutFlow(questions: SurveyQuestion[]): SurveyQuestion[] {
  if (questions.length === 0) return questions
  const groups = listQuestionGroups(questions)
  const groupByQuestion = new Map<string, string>()
  for (const group of groups) {
    for (const id of group.questionIds) groupByQuestion.set(id, group.id)
  }

  const g = new Graph()
  g.setGraph({ rankdir: "TB", nodesep: 72, ranksep: 96, marginx: 32, marginy: 32 })
  g.setDefaultEdgeLabel(() => ({}))

  const superSize = new Map<string, { width: number; height: number }>()

  for (const group of groups) {
    const heights = group.questionIds.map((id) => {
      const question = questions.find((item) => item.id === id)!
      return estimateQuestionHeight(question)
    })
    superSize.set(groupNodeId(group.id), {
      width: GROUP_NODE_WIDTH,
      height: groupHeight(group.questionIds.length, heights),
    })
  }
  for (const question of questions) {
    if (question.config.groupId) continue
    superSize.set(question.id, {
      width: QUESTION_NODE_WIDTH,
      height: estimateQuestionHeight(question),
    })
  }

  for (const [id, size] of superSize) {
    g.setNode(id, { width: size.width, height: size.height })
  }

  const linked = new Set<string>()
  for (const source of questions) {
    const from =
      groupByQuestion.get(source.id) != null
        ? groupNodeId(groupByQuestion.get(source.id)!)
        : source.id
    const targetIds = source.options.flatMap((option) =>
      collectBranchTargets(questions, source.id, option.id)
    )
    {
      for (const targetId of targetIds) {
        const to =
          groupByQuestion.get(targetId) != null
            ? groupNodeId(groupByQuestion.get(targetId)!)
            : targetId
        const key = `${from}->${to}`
        if (from === to || linked.has(key)) continue
        linked.add(key)
        g.setEdge(from, to)
      }
    }
  }

  // Keep unlinked supernodes in list order
  for (let i = 0; i < questions.length - 1; i++) {
    const a = questions[i]
    const b = questions[i + 1]
    const from = a.config.groupId ? groupNodeId(a.config.groupId) : a.id
    const to = b.config.groupId ? groupNodeId(b.config.groupId) : b.id
    const key = `${from}->${to}`
    if (from === to || linked.has(key)) continue
    if (superSize.has(from) && superSize.has(to)) {
      linked.add(key)
      g.setEdge(from, to)
    }
  }

  layout(g)

  return questions.map((question, index) => {
    const groupId = question.config.groupId
    if (groupId) {
      const group = groups.find((item) => item.id === groupId)!
      const size = superSize.get(groupNodeId(groupId))!
      const node = g.node(groupNodeId(groupId))
      const gx = node.x - size.width / 2
      const gy = node.y - size.height / 2
      const memberIndex = group.questionIds.indexOf(question.id)
      let y = GROUP_HEADER
      for (let i = 0; i < memberIndex; i++) {
        const member = questions.find((item) => item.id === group.questionIds[i])!
        y += estimateQuestionHeight(member) + CHILD_GAP
      }
      return {
        ...question,
        config: {
          ...question.config,
          groupX: gx,
          groupY: gy,
          flowX: GROUP_PAD,
          flowY: y,
        },
      }
    }
    const size = superSize.get(question.id)!
    const node = g.node(question.id)
    if (!node) {
      return {
        ...question,
        config: {
          ...question.config,
          flowX: 80,
          flowY: 80 + index * 180,
        },
      }
    }
    return {
      ...question,
      config: {
        ...question.config,
        flowX: node.x - size.width / 2,
        flowY: node.y - size.height / 2,
      },
    }
  })
}

export function buildFlowGraph(questions: SurveyQuestion[]): {
  nodes: FlowGraphNode[]
  edges: FlowGraphEdge[]
} {
  const groups = listQuestionGroups(questions)
  const nodes: FlowGraphNode[] = []
  const edges: FlowGraphEdge[] = []

  for (const group of groups) {
    const heights = group.questionIds.map((id) =>
      estimateQuestionHeight(questions.find((item) => item.id === id)!)
    )
    nodes.push({
      id: groupNodeId(group.id),
      type: "questionGroup",
      position: { x: group.x, y: group.y },
      width: GROUP_NODE_WIDTH,
      height: groupHeight(group.questionIds.length, heights),
      data: {
        groupId: group.id,
        prompt: group.name,
        memberCount: group.questionIds.length,
        options: [],
      },
    })
  }

  questions.forEach((question, index) => {
    const grouped = Boolean(question.config.groupId)
    nodes.push({
      id: question.id,
      type: "question",
      parentId: question.config.groupId
        ? groupNodeId(question.config.groupId)
        : undefined,
      position: {
        x: grouped ? (question.config.flowX ?? GROUP_PAD) : (question.config.flowX ?? 80 + (index % 3) * 340),
        y: grouped
          ? (question.config.flowY ?? GROUP_HEADER)
          : (question.config.flowY ?? 80 + Math.floor(index / 3) * 220),
      },
      width: QUESTION_NODE_WIDTH,
      height: estimateQuestionHeight(question),
      data: {
        questionId: question.id,
        index,
        prompt: question.prompt.trim() || "Untitled question",
        typeLabel: QUESTION_TYPE_MAP[question.type]?.label ?? question.type,
        required: Boolean(question.config.required),
        options: labeledAnswerOptions(question.options).map((option) => ({
          id: option.id,
          label: option.label || "Untitled option",
        })),
        hasIncoming: branchRefs(question).length > 0,
      },
    })
  })

  for (const source of questions) {
    for (const option of labeledAnswerOptions(source.options)) {
      const color = branchColor(option.id)
      for (const targetId of collectBranchTargets(
        questions,
        source.id,
        option.id
      )) {
        edges.push({
          id: `opt:${source.id}:${option.id}:q:${targetId}`,
          source: source.id,
          target: targetId,
          sourceHandle: optionHandleId(option.id),
          targetHandle: "in",
          kind: "branch",
          label: option.label,
          color,
          optionId: option.id,
          sourceQuestionId: source.id,
          targetQuestionId: targetId,
        })
      }
    }
  }

  appendDefaultSequenceEdges(questions, edges)

  return { nodes, edges }
}

/** Dashed default path: top-level order, plus the order inside each flow. */
function appendDefaultSequenceEdges(
  questions: SurveyQuestion[],
  edges: FlowGraphEdge[]
) {
  const link = (from: SurveyQuestion, to: SurveyQuestion) => {
    const id = `seq:${from.id}:${to.id}`
    if (edges.some((edge) => edge.id === id)) return
    edges.push({
      id,
      source: from.id,
      target: to.id,
      sourceHandle: "next",
      targetHandle: "in",
      kind: "sequence",
      color: "#8a8d86",
      sourceQuestionId: from.id,
      targetQuestionId: to.id,
    })
  }

  const topLevel = questions.filter((question) => branchRefs(question).length === 0)
  for (let index = 0; index < topLevel.length - 1; index++) {
    link(topLevel[index], topLevel[index + 1])
  }

  for (const source of questions) {
    for (const option of source.options) {
      const members = flowMemberIds(questions, source.id, option.id).map(
        (id) => questions.find((question) => question.id === id)!
      )
      for (let index = 0; index < members.length - 1; index++) {
        link(members[index], members[index + 1])
      }
    }
  }
}

export function parseBranchEdgeId(id: string): {
  sourceId: string
  optionId: string
  targetQuestionId?: string
  targetGroupId?: string
} | null {
  const match = /^opt:([^:]+):([^:]+):(q|g):(.+)$/.exec(id)
  if (!match) return null
  const [, sourceId, optionId, kind, rest] = match
  if (kind === "g") return { sourceId, optionId, targetGroupId: rest }
  return { sourceId, optionId, targetQuestionId: rest }
}

export function validateFlow(questions: SurveyQuestion[]): FlowIssue[] {
  const issues: FlowIssue[] = []

  if (questions.length === 0) {
    issues.push({
      severity: "info",
      message: "Add a question to start the flow.",
    })
    return issues
  }

  questions.forEach((question, index) => {
    for (const ref of branchRefs(question)) {
      const sourceIndex = questions.findIndex((item) => item.id === ref.questionId)
      const label = question.prompt || "Untitled"
      if (sourceIndex < 0) {
        issues.push({
          severity: "error",
          message: `“${label}” belongs to a flow of a question that no longer exists.`,
        })
      } else if (sourceIndex >= index) {
        issues.push({
          severity: "error",
          message: `“${label}” must come after the question that opens its flow.`,
        })
      }
    }
  })

  for (const source of questions) {
    if (!canBranchFromQuestion(source)) continue
    const routed = source.options.filter(
      (option) => flowMemberIds(questions, source.id, option.id).length > 0
    )
    if (routed.length > 0 && routed.length < source.options.length) {
      issues.push({
        severity: "info",
        message: `On “${source.prompt || "Untitled"}”, answers without a flow go straight to the next shared question.`,
      })
    }
  }

  for (const group of listQuestionGroups(questions)) {
    if (group.questionIds.length === 0) {
      issues.push({
        severity: "warning",
        message: `Question set “${group.name}” has no questions.`,
      })
    }
  }

  return uniqueIssues(issues)
}

export function describeRouting(
  questions: SurveyQuestion[],
  question: SurveyQuestion
): string[] {
  return labeledAnswerOptions(question.options)
    .map((option) => {
      const members = flowMemberIds(questions, question.id, option.id)
      if (members.length === 0) return null
      const names = members.map((id) => {
        const index = questions.findIndex((item) => item.id === id)
        return `Q${index + 1}`
      })
      return `${option.label} → ${names.join(", ")}`
    })
    .filter((line): line is string => Boolean(line))
}

function uniqueIssues(issues: FlowIssue[]): FlowIssue[] {
  const seen = new Set<string>()
  const result: FlowIssue[] = []
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.message}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(issue)
  }
  return result
}

export function resolveConnectionTargets(
  questions: SurveyQuestion[],
  targetNodeId: string
): string[] {
  const groupId = parseGroupNodeId(targetNodeId)
  if (groupId) {
    return (
      listQuestionGroups(questions).find((item) => item.id === groupId)
        ?.questionIds ?? []
    )
  }
  return questions.some((question) => question.id === targetNodeId)
    ? [targetNodeId]
    : []
}
