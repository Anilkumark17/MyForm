import { Graph, layout } from "@dagrejs/dagre"

import {
  hasShowIf,
  isFollowUpForOption,
  normalizeShowIf,
  toggleFollowUpForOption,
  type ShowIfRule,
} from "@/lib/survey/conditional"
import { QUESTION_TYPE_MAP } from "@/lib/survey/question-types"
import {
  labeledAnswerOptions,
  type SurveyQuestion,
} from "@/lib/survey/questions"

export const QUESTION_NODE_WIDTH = 280
export const GROUP_NODE_WIDTH = 320
const GROUP_HEADER = 52
const GROUP_PAD = 16
const CHILD_GAP = 14

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
    hasShowIf?: boolean
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
  return 96 + options * 30
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

export function collectBranchTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string
): string[] {
  return questions
    .filter((question) => isFollowUpForOption(question, sourceId, optionId))
    .map((question) => question.id)
}

function adjacency(questions: SurveyQuestion[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  for (const question of questions) graph.set(question.id, new Set())
  for (const source of questions) {
    for (const option of source.options) {
      for (const targetId of collectBranchTargets(questions, source.id, option.id)) {
        graph.get(source.id)?.add(targetId)
      }
    }
  }
  return graph
}

function canReach(
  graph: Map<string, Set<string>>,
  from: string,
  to: string
): boolean {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const node = stack.pop()!
    if (node === to) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const next of graph.get(node) ?? []) stack.push(next)
  }
  return false
}

export function wouldCreateCycle(
  questions: SurveyQuestion[],
  sourceId: string,
  targetIds: string[]
): boolean {
  if (targetIds.includes(sourceId)) return true
  const graph = adjacency(questions)
  for (const targetId of targetIds) {
    graph.get(sourceId)?.add(targetId)
    if (canReach(graph, targetId, sourceId)) return true
  }
  return false
}

export function connectOptionToTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  targetIds: string[]
): SurveyQuestion[] {
  let next = questions
  for (const targetId of targetIds) {
    next = toggleFollowUpForOption(next, sourceId, optionId, targetId, true)
  }
  return next
}

export function disconnectOptionFromTargets(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  targetIds: string[]
): SurveyQuestion[] {
  let next = questions
  for (const targetId of targetIds) {
    next = toggleFollowUpForOption(next, sourceId, optionId, targetId, false)
  }
  return next
}

function mergeShowIf(
  current: ShowIfRule | undefined,
  incoming: ShowIfRule
): ShowIfRule {
  const existing = current?.conditions ?? []
  const merged = existing.map((item) => ({
    ...item,
    values: [...item.values],
  }))
  for (const condition of incoming.conditions) {
    const found = merged.find(
      (item) =>
        item.questionId === condition.questionId &&
        item.operator === condition.operator
    )
    if (found) {
      found.values = [...new Set([...found.values, ...condition.values])]
    } else {
      merged.push(condition)
    }
  }
  return {
    logic: existing.length && current?.logic === "and" ? "and" : "or",
    conditions: merged,
  }
}

/** Merge a branch into a shared follow-up (OR the source visibility onto the target). */
export function connectMerge(
  questions: SurveyQuestion[],
  fromId: string,
  toId: string
): SurveyQuestion[] {
  if (fromId === toId) return questions
  const from = questions.find((question) => question.id === fromId)
  const to = questions.find((question) => question.id === toId)
  if (!from || !to) return questions
  const inherited = normalizeShowIf(from.config.showIf)
  if (!inherited) return questions
  return questions.map((question) => {
    if (question.id !== toId) return question
    return {
      ...question,
      config: {
        ...question.config,
        showIf: mergeShowIf(normalizeShowIf(question.config.showIf), inherited),
      },
    }
  })
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
    for (const option of source.options) {
      for (const targetId of collectBranchTargets(
        questions,
        source.id,
        option.id
      )) {
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
        hasShowIf: Boolean(normalizeShowIf(question.config.showIf)),
      },
    })
  })

  for (const source of questions) {
    for (const option of labeledAnswerOptions(source.options)) {
      const targets = collectBranchTargets(questions, source.id, option.id)
      if (targets.length === 0) continue
      const color = branchColor(option.id)
      const groupedTargets = new Map<string, string[]>()
      const loose: string[] = []
      for (const targetId of targets) {
        const target = questions.find((item) => item.id === targetId)
        const groupId = target?.config.groupId
        if (groupId) {
          const list = groupedTargets.get(groupId) ?? []
          list.push(targetId)
          groupedTargets.set(groupId, list)
        } else {
          loose.push(targetId)
        }
      }

      for (const [groupId, memberIds] of groupedTargets) {
        const group = groups.find((item) => item.id === groupId)
        const coversAll =
          group != null &&
          group.questionIds.every((id) => memberIds.includes(id))
        if (coversAll && group) {
          edges.push({
            id: `opt:${source.id}:${option.id}:g:${groupId}`,
            source: source.id,
            target: groupNodeId(groupId),
            sourceHandle: optionHandleId(option.id),
            targetHandle: "in",
            kind: "branch",
            label: option.label,
            color,
            optionId: option.id,
            sourceQuestionId: source.id,
            targetGroupId: groupId,
          })
        } else {
          for (const targetId of memberIds) {
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

      for (const targetId of loose) {
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

  for (const group of groups) {
    for (let i = 0; i < group.questionIds.length - 1; i++) {
      const from = group.questionIds[i]
      const to = group.questionIds[i + 1]
      edges.push({
        id: `seq:${from}:${to}`,
        source: from,
        target: to,
        sourceHandle: "next",
        targetHandle: "in",
        kind: "sequence",
        color: "#8a8d86",
        sourceQuestionId: from,
        targetQuestionId: to,
      })
    }
  }

  appendDefaultSequenceEdges(questions, groups, edges)

  return { nodes, edges }
}

function appendDefaultSequenceEdges(
  questions: SurveyQuestion[],
  groups: QuestionGroupInfo[],
  edges: FlowGraphEdge[]
) {
  const linked = new Set(edges.map((edge) => `${edge.source}->${edge.target}`))

  for (let index = 0; index < questions.length - 1; index++) {
    const fromQuestion = questions[index]
    const toQuestion = questions[index + 1]
    if (hasShowIf(toQuestion)) continue

    const fromGroup = fromQuestion.config.groupId
    const toGroup = toQuestion.config.groupId
    if (fromGroup && fromGroup === toGroup) continue

    if (toGroup && toGroup !== fromGroup) {
      const group = groups.find((item) => item.id === toGroup)
      if (group && group.questionIds[0] !== toQuestion.id) continue
    }

    const source =
      fromGroup && fromGroup !== toGroup
        ? groupNodeId(fromGroup)
        : fromQuestion.id
    const target =
      toGroup && toGroup !== fromGroup ? groupNodeId(toGroup) : toQuestion.id
    const key = `${source}->${target}`
    if (source === target || linked.has(key)) continue
    linked.add(key)
    edges.push({
      id: `seq:${source}:${target}`,
      source,
      target,
      sourceHandle: "next",
      targetHandle: "in",
      kind: "sequence",
      color: "#8a8d86",
      sourceQuestionId: fromQuestion.id,
      targetQuestionId: toQuestion.id,
    })
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
  const ids = new Set(questions.map((question) => question.id))

  if (questions.length === 0) {
    issues.push({
      severity: "info",
      message: "Add a question to start the flow.",
    })
    return issues
  }

  for (const question of questions) {
    const rule = normalizeShowIf(question.config.showIf)
    if (!rule) continue
    for (const condition of rule.conditions) {
      if (!ids.has(condition.questionId)) {
        issues.push({
          severity: "error",
          message: `“${question.prompt || "Untitled"}” depends on a missing question.`,
        })
      }
      if (condition.questionId === question.id) {
        issues.push({
          severity: "error",
          message: `“${question.prompt || "Untitled"}” cannot depend on itself.`,
        })
      }
    }
  }

  const graph = adjacency(questions)
  for (const [from, tos] of graph) {
    for (const to of tos) {
      if (canReach(graph, to, from)) {
        issues.push({
          severity: "error",
          message: "A branch loops back on itself. Loops are not allowed.",
        })
        break
      }
    }
  }

  for (const source of questions) {
    if (source.options.length === 0) continue
    const unlinked = source.options.filter(
      (option) => collectBranchTargets(questions, source.id, option.id).length === 0
    )
    if (unlinked.length > 0 && unlinked.length < source.options.length) {
      issues.push({
        severity: "warning",
        message: `Some answers on “${source.prompt || "Untitled"}” are not connected yet — those respondents continue in order.`,
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
