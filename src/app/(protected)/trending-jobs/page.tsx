'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Briefcase, Search, X, Sparkles, ArrowRight } from 'lucide-react'
import { trendingJobs, lastUpdated, JobItem } from '@/lib/trending-data'
import { PageHeader } from '@/components/layout/PageHeader'

export default function TrendingJobsPage() {
  const [selectedLevel, setSelectedLevel] = useState<'All' | 'Fresher' | 'Junior'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = useMemo(() => {
    return trendingJobs.filter((job: JobItem) => {
      // Level filter
      const matchesLevel =
        selectedLevel === 'All' || job.level === selectedLevel

      // Search query filter (matches role name or any skill)
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        job.role.toLowerCase().includes(q) ||
        job.skills.some((skill) => skill.toLowerCase().includes(q)) ||
        job.summary.toLowerCase().includes(q)

      return matchesLevel && matchesSearch
    })
  }, [selectedLevel, searchQuery])

  function handleClearFilters() {
    setSelectedLevel('All')
    setSearchQuery('')
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 1. Shared PageHeader with Last Updated badge on right */}
      <PageHeader
        badge="MARKET INSIGHTS"
        title="Trending Jobs"
        subtitle="Curated high-demand entry-level and fresher career tracks in India's technology ecosystem."
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-glass-subtle)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--ios-purple)]" />
            <span>Updated {lastUpdated}</span>
          </div>
        }
      />

      {/* 2. Unified Toolbar Row above the Grid: Filter Chips and Search Box */}
      <div className="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        {/* Experience Level Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">
            Experience:
          </span>
          {(['All', 'Fresher', 'Junior'] as const).map((level) => {
            const isActive = selectedLevel === level
            return (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedLevel(level)}
                className={`h-9 px-4 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'btn-primary'
                    : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {level === 'All' ? 'All Roles' : `${level} Roles`}
              </button>
            )
          })}
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search role or skill (e.g. React, Python)..."
            className="input h-9 pl-9 pr-8 text-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter feedback row if filtered */}
      {(selectedLevel !== 'All' || searchQuery) && (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] -mt-4 px-1">
          <span>
            Showing <strong className="text-[var(--text-primary)]">{filteredJobs.length}</strong> of{' '}
            {trendingJobs.length} roles
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-[var(--ios-blue)] hover:underline font-semibold cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      )}

      {/* 3. Grid of Job Cards: 1 col mobile, 2 col md, 3 col lg */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job: JobItem) => (
            <div
              key={job.role}
              className="card p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all duration-200 hover:border-[var(--ios-blue)]/40"
            >
              <div>
                {/* Header: Level info & badge */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Briefcase size={14} className="text-[var(--ios-blue)]" />
                    <span>{job.level} Role</span>
                  </span>

                  <span className="text-[0.65rem] font-bold text-[var(--ios-blue)] bg-[var(--ios-blue)]/15 border border-[var(--ios-blue)]/30 px-2.5 py-0.5 rounded-full">
                    {job.level}
                  </span>
                </div>

                {/* Role Title */}
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-3 leading-snug">
                  {job.role}
                </h2>

                {/* Summary */}
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                  {job.summary}
                </p>

                {/* Skills Chips */}
                <div>
                  <span className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
                    Core Skills:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="text-[0.68rem] font-medium text-[var(--text-secondary)] bg-[var(--bg-glass-subtle)] px-2.5 py-0.5 rounded-full border border-[var(--border)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: Check Recommendations */}
              <div className="pt-4 border-t border-[var(--border)] mt-auto">
                <Link
                  href="/jobs"
                  prefetch={true}
                  className="btn btn-secondary h-10 w-full inline-flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  <span>Compare with My Resume</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed border-[var(--border)]">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-glass-subtle)] border border-[var(--border)] flex items-center justify-center text-[var(--ios-blue)] mb-4">
            <Search size={22} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-2">
            No matching jobs found
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mb-5">
            No roles match &quot;{searchQuery}&quot; with experience &quot;{selectedLevel}&quot;. Try adjusting your search query or experience filter.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="btn btn-primary h-10 px-4 text-xs font-bold cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
