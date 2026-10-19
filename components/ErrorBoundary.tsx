'use client'
import { Component, ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: unknown, info: unknown) {
    console.error('3D scene failed to load, showing rest of page without it:', error, info)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}