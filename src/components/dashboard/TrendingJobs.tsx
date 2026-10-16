'use client'

import React, { memo } from 'react'
import Link from 'next/link'
import { Briefcase, ArrowRight } from 'lucide-react'
import { trendingJobs, lastUpdated, JobItem } from '@/lib/trending-data'

const PREVIEW_JOBS = trendingJobs.slice(0, 3)

export const TrendingJobs = memo(function TrendingJobs() {
  return (
    <div className="mb-10 w-full">
      {/* Header with Title and "View all trending jobs →" link */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h2 className="text-xl font-bold text-[var(--text-primary)] m-0">
              Trending Jobs
            </h2>
            <span className="inline-flex items-center gap-1.5 bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/35 text-[var(--brand-red)] text-xs font-bold px-2.5 py-0.5 rounded-full shadow-[inset_0_1px_0_var(--card-inset-highlight)]">
              🔥 Trending
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0">
            Active hiring domains for entry-level talent and freshers
          </p>
        </div>

        {/* Link Button going to /trending-jobs */}
        <Link
          href="/trending-jobs"
          prefetch={true}
          className="btn btn-primary text-xs h-9 px-4 gap-1.5"
        >
          <span>View all trending jobs</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 3-Card Grid Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {PREVIEW_JOBS.map((job: JobItem) => (
          <div
            key={job.role}
            className="card card-column h-full flex flex-col justify-between hover:border-[var(--brand-red)]/45 transition-all duration-200"
          >
            <div className="card-column-body flex flex-col">
              {/* Level indicator */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[0.72rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Briefcase size={13} className="text-[var(--brand-red)]" />
                  <span>{job.level} Role</span>
                </span>
                <span className="text-[0.68rem] font-bold text-[var(--brand-red)] bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/30 px-2.5 py-0.5 rounded-full">
                  {job.level}
                </span>
              </div>

              {/* Job Title */}
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2 leading-snug">
                {job.role}
              </h3>

              {/* Summary */}
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
                {job.summary}
              </p>

              {/* Skills required tag cloud */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {job.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[0.7rem] font-medium text-[var(--text-secondary)] bg-[var(--bg-glass-subtle)] border border-[var(--border)] px-2.5 py-0.5 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Link: Search Jobs pinned to bottom */}
            <div className="card-column-action mt-auto pt-2">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary w-full justify-center text-xs font-semibold"
              >
                <span>Search Jobs →</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Updated timestamp */}
      <div className="mt-2.5 text-xs text-[var(--text-muted)] text-right">
        Updated {lastUpdated}
      </div>
    </div>
  )
})

export default TrendingJobs
