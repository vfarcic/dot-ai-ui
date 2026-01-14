/**
 * Question Form Component
 * Multi-stage question wizard for the Recommend tool
 */

import { useState, useEffect } from 'react'
import type { Question } from '../../api/recommend'

interface QuestionFormProps {
  questions: Question[]
  currentStage: string
  nextStage: string | null
  onSubmit: (answers: Record<string, string | number>) => void
  onSkip?: () => void
  onGenerateManifests?: () => void
  isLoading?: boolean
  guidance?: string
}

/**
 * Get stage display name
 */
function getStageName(stage: string): string {
  switch (stage) {
    case 'required':
      return 'Required'
    case 'basic':
      return 'Basic'
    case 'advanced':
      return 'Advanced'
    case 'open':
      return 'Additional'
    default:
      return stage
  }
}

/**
 * Get stage description
 */
function getStageDescription(stage: string): string {
  switch (stage) {
    case 'required':
      return 'These fields are required to proceed'
    case 'basic':
      return 'Common configuration options'
    case 'advanced':
      return 'Fine-tune your deployment'
    case 'open':
      return 'Any additional customizations'
    default:
      return ''
  }
}

/**
 * Check if a stage is optional (can be skipped)
 */
function isOptionalStage(stage: string): boolean {
  return stage === 'basic' || stage === 'advanced' || stage === 'open'
}

/**
 * Individual question input component
 */
function QuestionInput({
  question,
  value,
  onChange,
  error,
}: {
  question: Question
  value: string | number
  onChange: (value: string | number) => void
  error?: string
}) {
  const inputId = `question-${question.id}`

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {question.question}
        {question.validation?.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {question.type === 'select' && question.options ? (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        >
          <option value="">Select an option...</option>
          {question.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : question.type === 'number' ? (
        <input
          type="number"
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.valueAsNumber || '')}
          placeholder={question.placeholder || question.suggestedAnswer?.toString()}
          min={question.validation?.min}
          max={question.validation?.max}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      ) : (
        <input
          type="text"
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || question.suggestedAnswer?.toString()}
          minLength={question.validation?.minLength}
          maxLength={question.validation?.maxLength}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      )}

      {/* Suggested answer hint */}
      {question.suggestedAnswer !== null && question.suggestedAnswer !== undefined && !value && (
        <p className="text-xs text-muted-foreground">
          Suggested: <span className="font-mono">{question.suggestedAnswer}</span>
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}

export function QuestionForm({
  questions,
  currentStage,
  nextStage,
  onSubmit,
  onSkip,
  onGenerateManifests,
  isLoading,
  guidance,
}: QuestionFormProps) {
  // Initialize answers from questions (use existing answers or suggested values)
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {}
    questions.forEach((q) => {
      if (q.answer !== undefined && q.answer !== null) {
        initial[q.id] = q.answer
      } else if (q.suggestedAnswer !== undefined && q.suggestedAnswer !== null) {
        initial[q.id] = q.suggestedAnswer
      } else {
        initial[q.id] = ''
      }
    })
    return initial
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset answers when questions change
  useEffect(() => {
    const initial: Record<string, string | number> = {}
    questions.forEach((q) => {
      if (q.answer !== undefined && q.answer !== null) {
        initial[q.id] = q.answer
      } else if (q.suggestedAnswer !== undefined && q.suggestedAnswer !== null) {
        initial[q.id] = q.suggestedAnswer
      } else {
        initial[q.id] = ''
      }
    })
    setAnswers(initial)
    setErrors({})
  }, [questions])

  const handleChange = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    questions.forEach((q) => {
      const value = answers[q.id]
      const validation = q.validation

      if (validation?.required && (value === '' || value === undefined || value === null)) {
        newErrors[q.id] = 'This field is required'
        return
      }

      if (value !== '' && value !== undefined && value !== null) {
        if (validation?.pattern) {
          const regex = new RegExp(validation.pattern)
          if (!regex.test(String(value))) {
            newErrors[q.id] = 'Invalid format'
          }
        }

        if (q.type === 'number') {
          const numValue = Number(value)
          if (validation?.min !== undefined && numValue < validation.min) {
            newErrors[q.id] = `Minimum value is ${validation.min}`
          }
          if (validation?.max !== undefined && numValue > validation.max) {
            newErrors[q.id] = `Maximum value is ${validation.max}`
          }
        }

        if (q.type === 'text') {
          const strValue = String(value)
          if (validation?.minLength !== undefined && strValue.length < validation.minLength) {
            newErrors[q.id] = `Minimum length is ${validation.minLength} characters`
          }
          if (validation?.maxLength !== undefined && strValue.length > validation.maxLength) {
            newErrors[q.id] = `Maximum length is ${validation.maxLength} characters`
          }
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      // Filter out empty values for optional fields
      const nonEmptyAnswers: Record<string, string | number> = {}
      Object.entries(answers).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          nonEmptyAnswers[key] = value
        }
      })
      onSubmit(nonEmptyAnswers)
    }
  }

  const isOptional = isOptionalStage(currentStage)
  const canSkip = isOptional && onSkip
  const isLastStage = !nextStage || nextStage === 'generateManifests'

  return (
    <div className="space-y-4">
      {/* Stage indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            {getStageName(currentStage)} Configuration
            {isOptional && (
              <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getStageDescription(currentStage)}
          </p>
        </div>
        {nextStage && nextStage !== 'generateManifests' && (
          <span className="text-xs text-muted-foreground">
            Next: {getStageName(nextStage)}
          </span>
        )}
      </div>

      {/* Guidance message */}
      {guidance && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
          {guidance}
        </div>
      )}

      {/* Questions form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {questions.map((question) => (
          <QuestionInput
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => handleChange(question.id, value)}
            error={errors[question.id]}
          />
        ))}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {canSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Skip this stage
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLastStage && onGenerateManifests && (
              <button
                type="button"
                onClick={onGenerateManifests}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Manifests
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : isLastStage ? (
                'Continue'
              ) : (
                <>
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
