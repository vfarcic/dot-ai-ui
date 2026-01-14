/**
 * Manifest Preview Component
 * Displays generated YAML manifests with syntax highlighting and deploy action
 */

import { useState, useEffect } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-yaml'
import type { ManifestFile, DeploymentResult } from '../../api/recommend'

interface ManifestPreviewProps {
  files: ManifestFile[]
  outputFormat: string
  outputPath: string
  onDeploy: () => void
  isDeploying?: boolean
  deployResults?: DeploymentResult[]
}

/**
 * Copy button component
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

/**
 * Download button component
 */
function DownloadButton({ filename, content }: { filename: string; content: string }) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
      title="Download file"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>Download</span>
    </button>
  )
}

/**
 * Single manifest file display
 */
function ManifestFileView({ file }: { file: ManifestFile }) {
  const [highlighted, setHighlighted] = useState('')

  useEffect(() => {
    const html = Prism.highlight(file.content, Prism.languages.yaml, 'yaml')
    setHighlighted(html)
  }, [file.content])

  const filename = file.relativePath.split('/').pop() || file.relativePath

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-mono text-muted-foreground">{file.relativePath}</span>
        <div className="flex items-center gap-1">
          <CopyButton text={file.content} />
          <DownloadButton filename={filename} content={file.content} />
        </div>
      </div>

      {/* File content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed m-0">
          <code
            className="language-yaml"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  )
}

/**
 * Deployment results display
 */
function DeploymentResults({ results }: { results: DeploymentResult[] }) {
  const successCount = results.filter((r) => r.status === 'created' || r.status === 'configured' || r.status === 'unchanged').length
  const failureCount = results.filter((r) => r.status === 'failed').length

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {failureCount === 0 ? (
          <>
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-green-400">Deployment Successful</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-red-400">Deployment had errors</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          ({successCount} succeeded, {failureCount} failed)
        </span>
      </div>

      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 p-2 rounded text-sm ${
              result.status === 'failed'
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-green-500/10 border border-green-500/30'
            }`}
          >
            {result.status === 'failed' ? (
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <div className={`font-mono ${result.status === 'failed' ? 'text-red-400' : 'text-green-400'}`}>
                {result.resource}
              </div>
              <div className="text-muted-foreground text-xs">{result.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ManifestPreview({
  files,
  outputFormat,
  outputPath,
  onDeploy,
  isDeploying,
  deployResults,
}: ManifestPreviewProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0)

  // Combine all files for "Download All"
  const allContent = files.map((f) => `# File: ${f.relativePath}\n${f.content}`).join('\n---\n')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Generated Manifests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Format: <span className="font-mono">{outputFormat}</span> | Path: <span className="font-mono">{outputPath}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const blob = new Blob([allContent], { type: 'text/yaml' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'manifests.yaml'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download All
          </button>
          {!deployResults && (
            <button
              onClick={onDeploy}
              disabled={isDeploying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deploying...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Deploy to Cluster
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Deployment results */}
      {deployResults && <DeploymentResults results={deployResults} />}

      {/* File tabs (if multiple files) */}
      {files.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border">
          {files.map((file, index) => (
            <button
              key={file.relativePath}
              onClick={() => setActiveFileIndex(index)}
              className={`px-3 py-2 text-sm font-mono transition-colors ${
                index === activeFileIndex
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {file.relativePath.split('/').pop()}
            </button>
          ))}
        </div>
      )}

      {/* Active file content */}
      <ManifestFileView file={files[activeFileIndex]} />

      {/* All files (collapsed) */}
      {files.length > 1 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground py-2 flex items-center gap-2">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Show all {files.length} files
          </summary>
          <div className="space-y-4 mt-4">
            {files.map((file, index) => (
              index !== activeFileIndex && <ManifestFileView key={file.relativePath} file={file} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
