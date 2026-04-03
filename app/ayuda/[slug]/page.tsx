import { readFileSync } from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import { ArrowLeft, BookOpen } from 'lucide-react'
import articulos from '@/content/help/index.json'

type Params = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return articulos.map((a) => ({ slug: a.slug }))
}

export default async function AyudaArticlePage({ params }: Params) {
  const { slug } = await params

  if (!/^[a-z0-9-]+$/.test(slug)) notFound()

  let content: string
  try {
    const filePath = path.join(process.cwd(), 'content', 'help', `${slug}.md`)
    content = readFileSync(filePath, 'utf-8')
  } catch {
    notFound()
  }

  const html = marked(content) as string
  const articulo = articulos.find((a) => a.slug === slug)

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link
          href="/ayuda"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Centro de Ayuda
        </Link>
        {articulo && (
          <>
            <span className="text-muted-foreground/70">/</span>
            <span className="text-muted-foreground font-medium">{articulo.titulo}</span>
          </>
        )}
      </div>

      {/* Article */}
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Documentación
          </span>
        </div>
        <div
          className="prose prose-slate max-w-none
            prose-headings:font-semibold prose-headings:text-foreground
            prose-h1:text-2xl prose-h1:mb-6
            prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-li:text-muted-foreground prose-li:leading-relaxed
            prose-strong:text-foreground prose-strong:font-semibold
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-foreground prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:text-xs
            prose-table:text-sm prose-th:bg-muted/40 prose-th:font-semibold prose-th:text-foreground
            prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1
            prose-hr:border-border prose-hr:my-6
            [&_table]:w-full [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden
            [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:border-b [&_th]:border-border
            [&_td]:px-4 [&_td]:py-2 [&_td]:border-t [&_td]:border-border
            [&_tr:hover_td]:bg-muted/40"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Navigation to other articles */}
      <div className="mt-8">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Otros módulos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {articulos
            .filter((a) => a.slug !== slug)
            .map((a) => (
              <Link
                key={a.slug}
                href={`/ayuda/${a.slug}`}
                className="px-3 py-2 bg-card border border-border rounded-lg text-xs text-muted-foreground hover:border-blue-400 hover:text-primary transition-colors truncate"
              >
                {a.titulo}
              </Link>
            ))}
        </div>
      </div>
    </div>
  )
}
