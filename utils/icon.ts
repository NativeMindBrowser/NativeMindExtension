import IconDownload from '@/assets/icons/md-download.svg?raw'
import IconEdit from '@/assets/icons/md-edit.svg?raw'
import IconFileSuccess from '@/assets/icons/md-file-success.svg?raw'
import IconFind from '@/assets/icons/md-find.svg?raw'
import IconHighlightBoxed from '@/assets/icons/md-highlight-boxed.svg?raw'
import IconLink from '@/assets/icons/md-link.svg?raw'
import IconQuickModified from '@/assets/icons/md-quick-action-modified.svg?raw'
import IconSearch from '@/assets/icons/md-search.svg?raw'
import IconSearchBoxed from '@/assets/icons/md-search-boxed.svg?raw'
import IconSearchColored from '@/assets/icons/md-search-colored.svg?raw'
import IconStar from '@/assets/icons/md-star.svg?raw'
import IconSummarizeBoxed from '@/assets/icons/md-summarize-boxed.svg?raw'
import IconTick from '@/assets/icons/md-tick.svg?raw'
import IconTickColored from '@/assets/icons/md-tick-colored.svg?raw'
import IconTranslationBoxed from '@/assets/icons/md-translation-boxed.svg?raw'
import IconWarning from '@/assets/icons/md-warning.svg?raw'
import IconWarningColored from '@/assets/icons/md-warning-colored.svg?raw'
import IconWritingBoxed from '@/assets/icons/md-writing-boxed.svg?raw'
import IconPdf from '@/assets/icons/pdf-icon.svg?raw'
import IconTaskClickPage from '@/assets/icons/task-click-page.svg?raw'
import IconTaskFetchPage from '@/assets/icons/task-fetch-page.svg?raw'
import IconTaskReadFile from '@/assets/icons/task-read-file.svg?raw'
import IconTaskSearch from '@/assets/icons/task-search.svg?raw'
import IconWeb from '@/assets/icons/web.svg?raw'

export const iconMap = {
  tick: IconTick,
  tickColored: IconTickColored,
  search: IconSearch,
  searchColored: IconSearchColored,
  link: IconLink,
  download: IconDownload,
  warning: IconWarning,
  warningColored: IconWarningColored,
  find: IconFind,
  fileSuccess: IconFileSuccess,
  star: IconStar,
  summarizeBoxed: IconSummarizeBoxed,
  translationBoxed: IconTranslationBoxed,
  writingBoxed: IconWritingBoxed,
  highlightBoxed: IconHighlightBoxed,
  edit: IconEdit,
  quickActionModifiedBoxed: IconQuickModified,
  searchBoxed: IconSearchBoxed,
  web: IconWeb,
  taskSearch: IconTaskSearch,
  taskReadFile: IconTaskReadFile,
  taskFetchPage: IconTaskFetchPage,
  taskClickPage: IconTaskClickPage,
  pdf: IconPdf,
}

export type IconName = keyof typeof iconMap
