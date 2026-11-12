'use client'
import { createContext, useContext } from 'react'
import { DEFAULT_LABELS, type MarkdownLabels } from '../render/labels'

export {
  DEFAULT_LABELS,
  mergeLabels,
  type LabelOverrides,
  type MarkdownLabels,
} from '../render/labels'

export const LabelsContext = createContext<MarkdownLabels>(DEFAULT_LABELS)

export const useLabels = () => useContext(LabelsContext)
