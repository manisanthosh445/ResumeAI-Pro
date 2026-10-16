export interface TrendingJob {
  title: string
  category: string
  reason: string
  skills: string[]
  demandLevel: 'High' | 'Very High'
  salaryRange: string
}

export const TARGET_COUNTRY = 'India'

export const FALLBACK_TRENDING_JOBS: TrendingJob[] = [
  {
    title: 'Frontend Developer',
    category: 'Software',
    reason: 'Surging enterprise demand for modern, responsive React & Next.js user interfaces.',
    skills: ['React', 'TypeScript', 'Tailwind CSS'],
    demandLevel: 'Very High',
    salaryRange: '₹4.5 - ₹8 LPA (est.)',
  },
  {
    title: 'Backend Developer',
    category: 'Software',
    reason: 'Rapid expansion of cloud APIs, microservices architecture, and scalable system design.',
    skills: ['Node.js', 'Python', 'PostgreSQL'],
    demandLevel: 'High',
    salaryRange: '₹5 - ₹9 LPA (est.)',
  },
  {
    title: 'Full Stack Developer',
    category: 'Software',
    reason: 'High startup preference for versatile engineers capable of end-to-end delivery.',
    skills: ['Next.js', 'Node.js', 'PostgreSQL'],
    demandLevel: 'Very High',
    salaryRange: '₹5 - ₹10 LPA (est.)',
  },
  {
    title: 'Data Analyst',
    category: 'Data',
    reason: 'Massive adoption of data-driven decision making and business intelligence dashboards.',
    skills: ['Python', 'SQL', 'Power BI'],
    demandLevel: 'High',
    salaryRange: '₹4 - ₹7.5 LPA (est.)',
  },
  {
    title: 'Machine Learning Engineer',
    category: 'Data',
    reason: 'Exploding demand for integrating LLMs, predictive models, and GenAI workflows.',
    skills: ['Python', 'PyTorch', 'Hugging Face'],
    demandLevel: 'Very High',
    salaryRange: '₹6 - ₹12 LPA (est.)',
  },
  {
    title: 'DevOps Engineer',
    category: 'Cloud',
    reason: 'Need for automated CI/CD pipelines, containerization, and reliable release cycles.',
    skills: ['Docker', 'Kubernetes', 'CI/CD Pipelines'],
    demandLevel: 'High',
    salaryRange: '₹5.5 - ₹9.5 LPA (est.)',
  },
  {
    title: 'Cloud Engineer',
    category: 'Cloud',
    reason: 'Accelerating digital migration to AWS, Azure, and cloud-native infrastructure.',
    skills: ['AWS', 'Linux', 'Terraform'],
    demandLevel: 'High',
    salaryRange: '₹5 - ₹9 LPA (est.)',
  },
  {
    title: 'UI/UX Designer',
    category: 'Design',
    reason: 'Focus on user retention, modern design systems, and mobile-first product experiences.',
    skills: ['Figma', 'Prototyping', 'User Research'],
    demandLevel: 'High',
    salaryRange: '₹4 - ₹7 LPA (est.)',
  },
]
