'use client'

import React, { memo } from 'react'
import { BookOpen } from 'lucide-react'
import { trendingCourses, lastUpdated, CourseItem } from '@/lib/trending-data'

export const TrendingCourses = memo(function TrendingCourses() {
  return (
    <div className="mb-10 w-full">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h2 className="text-xl font-bold text-[var(--text-primary)] m-0">
            Trending Courses
          </h2>
          <span className="inline-flex items-center gap-1.5 bg-[var(--brand-red)]/15 border border-[var(--brand-red)]/35 text-[var(--brand-red)] text-xs font-bold px-2.5 py-0.5 rounded-full shadow-[inset_0_1px_0_var(--card-inset-highlight)]">
            🔥 Trending
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] m-0">
          Top skill-building programs for engineering freshers &amp; developers
        </p>
      </div>

      {/* Grid: 4 cols on lg, 2 on sm, 1 on mobile, showing 8 cards in 2 clean rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {trendingCourses.map((course: CourseItem) => (
          <div
            key={course.title}
            className="card card-column h-full flex flex-col justify-between hover:border-[var(--brand-red)]/45 transition-all duration-200"
          >
            <div className="card-column-body flex flex-col">
              {/* 1. Platform label and level pill in one row */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[0.72rem] font-bold text-[var(--brand-red)] uppercase tracking-wider inline-flex items-center gap-1.5">
                  <BookOpen size={13} />
                  <span>{course.platform}</span>
                </span>

                <span className="text-[0.68rem] font-bold text-[var(--text-secondary)] bg-[var(--bg-glass-subtle)] border border-[var(--border)] px-2.5 py-0.5 rounded-full">
                  {course.level}
                </span>
              </div>

              {/* 2. Course Title */}
              <h3 className="text-[0.98rem] font-bold text-[var(--text-primary)] mb-2 leading-snug">
                {course.title}
              </h3>

              {/* 3. Topic Tag */}
              <div className="mb-3">
                <span className="text-[0.72rem] text-[var(--text-secondary)] bg-[var(--bg-glass-subtle)] border border-[var(--border)] px-2.5 py-0.5 rounded-full inline-block">
                  {course.topic}
                </span>
              </div>

              {/* 4. Duration */}
              <div className="text-xs text-[var(--text-muted)] mb-5">
                ⏱️ {course.duration}
              </div>
            </div>

            {/* 5. "View Course →" button pinned to bottom */}
            <div className="card-column-action mt-auto pt-2">
              <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary w-full justify-center text-xs font-semibold"
              >
                <span>View Course →</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Updated timestamp aligned to right of grid */}
      <div className="mt-2.5 text-xs text-[var(--text-muted)] text-right">
        Updated {lastUpdated}
      </div>
    </div>
  )
})

export default TrendingCourses
