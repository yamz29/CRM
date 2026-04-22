declare module 'frappe-gantt' {
  export interface GanttTask {
    id: string
    name: string
    start: string
    end: string
    progress: number
    dependencies: string
    custom_class?: string
  }

  export interface GanttOptions {
    view_mode?: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year'
    date_format?: string
    language?: string
    bar_height?: number
    bar_corner_radius?: number
    padding?: number
    readonly?: boolean
    custom_popup_html?: (task: GanttTask) => string
    on_date_change?: (task: GanttTask, start: Date, end: Date) => void
    on_progress_change?: (task: GanttTask, progress: number) => void
    on_click?: (task: GanttTask) => void
    on_view_change?: (mode: string) => void
  }

  export default class Gantt {
    constructor(element: HTMLElement, tasks: GanttTask[], options?: GanttOptions)
    change_view_mode(mode: string): void
    refresh(tasks: GanttTask[]): void
  }
}

declare module 'frappe-gantt/dist/frappe-gantt.css'
