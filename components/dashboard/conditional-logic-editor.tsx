"use client"

import { GitBranchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  SUBMIT_TARGET,
  branchRefs,
  canBranchFrom,
  flowMemberIds,
  getSections,
  hasOutgoingBranches,
  hasSections,
  laterQuestions,
  questionRefLabel,
  toggleFlowMember,
} from "@/lib/survey/conditional"
import { describeRouting } from "@/lib/survey/flow-graph"
import {
  labeledAnswerOptions,
  type SurveyQuestion,
} from "@/lib/survey/questions"

type ConditionalLogicEditorProps = {
  question: SurveyQuestion
  questions: SurveyQuestion[]
  onQuestionsChange: (questions: SurveyQuestion[]) => void
}

export function ConditionalLogicEditor({
  question,
  questions,
  onQuestionsChange,
}: ConditionalLogicEditorProps) {
  if (hasSections(questions)) {
    return (
      <SectionRouting
        question={question}
        questions={questions}
        onQuestionsChange={onQuestionsChange}
      />
    )
  }

  const later = laterQuestions(questions, question.id)
  const branchable = canBranchFrom(question)
  const active = hasOutgoingBranches(questions, question)
  const inFlow = branchRefs(question).length > 0

  return (
    <details className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <GitBranchIcon className="size-3.5 text-muted-foreground" />
          Conditional logic
          {active ? (
            <Badge variant="secondary">On</Badge>
          ) : inFlow ? (
            <Badge variant="outline">In a flow</Badge>
          ) : (
            <span className="font-normal text-muted-foreground">Optional</span>
          )}
        </span>
      </summary>

      <div className="mt-3 space-y-3">
        {inFlow ? (
          <p className="text-sm text-muted-foreground">
            Shown only when a respondent picks the matching answer on{" "}
            {[...new Set(branchRefs(question).map((ref) => ref.questionId))]
              .map((id) => questionRefLabel(questions, id))
              .join(", ")}
            .
          </p>
        ) : null}

        {!branchable ? (
          <p className="text-sm text-muted-foreground">
            Only single choice, dropdown and yes/no questions can open a
            different flow per answer.
          </p>
        ) : later.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add questions below this one, then choose which ones each answer
            shows.
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Tick the questions each answer should lead to. Each answer runs
              only its own flow, then everyone continues with the questions
              that are not in any flow.
            </p>
            {labeledAnswerOptions(question.options).map((option) => (
              <div
                key={option.id}
                className="rounded-md border border-border/70 bg-background/70 p-3"
              >
                <p className="text-sm font-medium">
                  If “{option.label || "Untitled option"}” is selected, show
                </p>
                <div className="mt-2 space-y-1.5">
                  {later.map((followUp) => (
                    <label
                      key={followUp.id}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Checkbox
                        checked={flowMemberIds(
                          questions,
                          question.id,
                          option.id
                        ).includes(followUp.id)}
                        onCheckedChange={(next) =>
                          onQuestionsChange(
                            toggleFlowMember(
                              questions,
                              question.id,
                              option.id,
                              followUp.id,
                              Boolean(next)
                            )
                          )
                        }
                      />
                      <span className="leading-snug">
                        {questionRefLabel(questions, followUp.id)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </details>
  )
}

export function BranchingOverview({
  questions,
}: {
  questions: SurveyQuestion[]
}) {
  const sources = questions.filter((question) =>
    hasOutgoingBranches(questions, question)
  )
  if (sources.length === 0) return null

  return (
    <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <GitBranchIcon className="size-3.5 text-muted-foreground" />
        Branching map
      </div>
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {sources.map((source) => (
          <li key={source.id}>
            <span className="font-medium text-foreground">
              {questionRefLabel(questions, source.id)}
            </span>
            <ul className="mt-1 space-y-0.5 pl-3">
              {describeRouting(questions, source).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionRouting({
  question,
  questions,
  onQuestionsChange,
}: ConditionalLogicEditorProps) {
  if (!canBranchFrom(question)) return null
  const sections = getSections(questions)
  const own = sections.findIndex((section) =>
    section.questions.some((item) => item.id === question.id)
  )
  const later = sections.slice(own + 1)
  const active = Object.keys(question.config.goTo ?? {}).length > 0

  function setTarget(optionId: string, target: string) {
    onQuestionsChange(
      questions.map((item) => {
        if (item.id !== question.id) return item
        const goTo = { ...(item.config.goTo ?? {}) }
        if (target) goTo[optionId] = target
        else delete goTo[optionId]
        return {
          ...item,
          config: {
            ...item.config,
            goTo: Object.keys(goTo).length > 0 ? goTo : undefined,
          },
        }
      })
    )
  }

  return (
    <details className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <GitBranchIcon className="size-3.5 text-muted-foreground" />
          Go to section based on answer
          {active ? <Badge variant="secondary">On</Badge> : null}
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {later.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a later section to send answers there, or choose Submit form.
          </p>
        ) : null}
        {labeledAnswerOptions(question.options).map((option) => (
          <div
            key={option.id}
            className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
          >
            <span className="truncate text-sm">{option.label}</span>
            <NativeSelect
              aria-label={`Where “${option.label}” goes`}
              className="w-full"
              value={question.config.goTo?.[option.id] ?? ""}
              onChange={(event) => setTarget(option.id, event.target.value)}
            >
              <NativeSelectOption value="">
                Continue to next section
              </NativeSelectOption>
              {later.map((section, offset) => (
                <NativeSelectOption key={section.id} value={section.id}>
                  Go to section {own + offset + 2}
                  {section.title ? `: ${section.title}` : ""}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={SUBMIT_TARGET}>
                Submit form
              </NativeSelectOption>
            </NativeSelect>
          </div>
        ))}
      </div>
    </details>
  )
}
