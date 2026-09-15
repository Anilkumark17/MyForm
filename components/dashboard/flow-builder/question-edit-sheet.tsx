"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { listQuestionGroups } from "@/lib/survey/flow-graph"
import {
  questionTypesByCategory,
  QUESTION_TYPE_MAP,
  type QuestionTypeId,
} from "@/lib/survey/question-types"
import {
  applyTypeChange,
  commitOptionLabel,
  createOption,
  isDraftOptionId,
  labeledAnswerOptions,
  optionRowsForEditor,
  type SurveyQuestion,
} from "@/lib/survey/questions"

const typeGroups = questionTypesByCategory()

type QuestionEditSheetProps = {
  question: SurveyQuestion | null
  questions: SurveyQuestion[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (questionId: string, patch: Partial<SurveyQuestion>) => void
  onOptionsChange: (questionId: string, question: SurveyQuestion) => void
}

export function QuestionEditSheet({
  question,
  questions,
  open,
  onOpenChange,
  onChange,
  onOptionsChange,
}: QuestionEditSheetProps) {
  if (!question) return null
  const meta = QUESTION_TYPE_MAP[question.type]
  const groups = listQuestionGroups(questions)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit question</SheetTitle>
          <SheetDescription>
            Changes stay in sync with the form editor.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`flow-prompt-${question.id}`}>Question</Label>
            <Textarea
              id={`flow-prompt-${question.id}`}
              value={question.prompt}
              rows={3}
              onChange={(event) =>
                onChange(question.id, { prompt: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`flow-type-${question.id}`}>Answer type</Label>
            <NativeSelect
              id={`flow-type-${question.id}`}
              className="w-full"
              value={question.type}
              onChange={(event) =>
                onChange(question.id, {
                  ...applyTypeChange(
                    question,
                    event.target.value as QuestionTypeId
                  ),
                })
              }
            >
              {[...typeGroups.entries()].map(([category, types]) => (
                <NativeSelectOptGroup key={category} label={category}>
                  {types.map((type) => (
                    <NativeSelectOption key={type.id} value={type.id}>
                      {type.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(question.config.required)}
              onCheckedChange={(checked) =>
                onChange(question.id, {
                  config: {
                    ...question.config,
                    required: Boolean(checked),
                  },
                })
              }
            />
            Required
          </label>
          {groups.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`flow-group-${question.id}`}>Question set</Label>
              <NativeSelect
                id={`flow-group-${question.id}`}
                className="w-full"
                value={question.config.groupId ?? ""}
                onChange={(event) => {
                  const groupId = event.target.value || undefined
                  const group = groups.find((item) => item.id === groupId)
                  onChange(question.id, {
                    config: {
                      ...question.config,
                      groupId,
                      groupName: group?.name,
                      groupX: group?.x,
                      groupY: group?.y,
                    },
                  })
                }}
              >
                <NativeSelectOption value="">No set</NativeSelectOption>
                {groups.map((group) => (
                  <NativeSelectOption key={group.id} value={group.id}>
                    {group.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {meta.hasOptions ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Answers</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const labeled = labeledAnswerOptions(question.options)
                    onOptionsChange(question.id, {
                      ...question,
                      options: [
                        ...labeled,
                        createOption(`Option ${labeled.length + 1}`),
                      ],
                    })
                  }}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              </div>
              {optionRowsForEditor(question.options, question.id).map(
                (option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Input
                    value={option.label}
                    onChange={(event) =>
                      onOptionsChange(question.id, {
                        ...question,
                        options: commitOptionLabel(
                          question.options,
                          option.id,
                          event.target.value
                        ),
                      })
                    }
                    placeholder={
                      isDraftOptionId(option.id)
                        ? "Add option"
                        : `Option ${index + 1}`
                    }
                  />
                  {isDraftOptionId(option.id) ? null : (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete option"
                    disabled={
                      labeledAnswerOptions(question.options).length <= 1
                    }
                    onClick={() =>
                      onOptionsChange(question.id, {
                        ...question,
                        options: question.options.filter(
                          (item) => item.id !== option.id
                        ),
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
