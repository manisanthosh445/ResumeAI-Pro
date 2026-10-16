export interface CourseItem {
  title: string
  platform: string
  topic: string
  level: 'Beginner' | 'Intermediate'
  duration: string
  url: string
}

export interface JobItem {
  role: string
  summary: string
  skills: string[]
  level: 'Fresher' | 'Junior'
  url: string
}

export const lastUpdated = 'October 2026'

export const trendingCourses: CourseItem[] = [
  {
    title: 'Generative AI & LLM Application Development',
    platform: 'Coursera',
    topic: 'Generative AI',
    level: 'Intermediate',
    duration: '4-6 weeks',
    url: 'https://www.coursera.org/search?query=generative+ai+llm+application+development',
  },
  {
    title: 'Python for Beginners & Automated Workflows',
    platform: 'Udemy',
    topic: 'Python',
    level: 'Beginner',
    duration: '18 hours',
    url: 'https://www.udemy.com/courses/search/?q=python+programming+complete+beginner',
  },
  {
    title: 'Data Structures & Algorithms in Java & C++',
    platform: 'YouTube',
    topic: 'DSA & Coding',
    level: 'Intermediate',
    duration: '35 hours',
    url: 'https://www.youtube.com/results?search_query=data+structures+and+algorithms+interview+prep',
  },
  {
    title: 'Modern Full-Stack Web with React & Next.js',
    platform: 'Coursera',
    topic: 'Web Development',
    level: 'Beginner',
    duration: '6 weeks',
    url: 'https://www.coursera.org/search?query=full+stack+react+nextjs+web+development',
  },
  {
    title: 'Complete SQL & Relational Database Mastery',
    platform: 'Udemy',
    topic: 'SQL & Databases',
    level: 'Beginner',
    duration: '10 hours',
    url: 'https://www.udemy.com/courses/search/?q=sql+database+bootcamp+postgresql+mysql',
  },
  {
    title: 'AWS Cloud Practitioner & Cloud Fundamentals',
    platform: 'Coursera',
    topic: 'Cloud Computing',
    level: 'Beginner',
    duration: '4 weeks',
    url: 'https://www.coursera.org/search?query=aws+certified+cloud+practitioner+fundamentals',
  },
  {
    title: 'Cybersecurity Basics & Network Defense Fundamentals',
    platform: 'edX',
    topic: 'Cybersecurity',
    level: 'Beginner',
    duration: '5 weeks',
    url: 'https://www.edx.org/search?q=cybersecurity+fundamentals+basics',
  },
  {
    title: 'Git, GitHub & DevOps CI/CD Pipeline Basics',
    platform: 'YouTube',
    topic: 'DevOps & Git',
    level: 'Beginner',
    duration: '8 hours',
    url: 'https://www.youtube.com/results?search_query=git+github+devops+cicd+tutorial+for+beginners',
  },
]

export const trendingJobs: JobItem[] = [
  {
    role: 'Frontend Developer',
    summary: 'Building responsive, fast, and accessible user interfaces with React, Next.js, and TypeScript.',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    level: 'Fresher',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Frontend+Developer&location=India&f_E=1%2C2',
  },
  {
    role: 'Full-Stack Developer',
    summary: 'Delivering end-to-end web applications combining robust backend services with polished frontends.',
    skills: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
    level: 'Junior',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Full+Stack+Developer&location=India&f_E=1%2C2',
  },
  {
    role: 'Data Analyst',
    summary: 'Transforming raw business data into actionable dashboards, KPIs, and statistical insights.',
    skills: ['Python', 'SQL', 'Power BI', 'Excel'],
    level: 'Fresher',
    url: 'https://www.naukri.com/data-analyst-jobs-for-freshers',
  },
  {
    role: 'AI / ML Engineer',
    summary: 'Fine-tuning foundational models, integrating LLM APIs, and building automated GenAI agents.',
    skills: ['Python', 'PyTorch', 'Hugging Face', 'LangChain'],
    level: 'Junior',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Machine+Learning+Engineer&location=India&f_E=1%2C2',
  },
  {
    role: 'Backend Developer',
    summary: 'Designing scalable microservices, database schemas, and secure authentication systems.',
    skills: ['Node.js', 'Python', 'PostgreSQL', 'Docker'],
    level: 'Fresher',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Backend+Developer&location=India&f_E=1%2C2',
  },
  {
    role: 'DevOps Engineer',
    summary: 'Automating continuous integration, container orchestration, and cloud infrastructure deployment.',
    skills: ['Docker', 'Kubernetes', 'GitHub Actions', 'AWS'],
    level: 'Junior',
    url: 'https://www.linkedin.com/jobs/search/?keywords=DevOps+Engineer&location=India&f_E=1%2C2',
  },
  {
    role: 'QA / Test Engineer',
    summary: 'Writing automated end-to-end tests, unit test suites, and ensuring product reliability.',
    skills: ['Selenium', 'Playwright', 'Jest', 'API Testing'],
    level: 'Fresher',
    url: 'https://www.naukri.com/qa-tester-jobs-for-freshers',
  },
  {
    role: 'Cybersecurity Analyst',
    summary: 'Monitoring security logs, assessing vulnerabilities, and enforcing access control policies.',
    skills: ['Network Security', 'Linux', 'SIEM', 'Penetration Testing'],
    level: 'Junior',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Cybersecurity+Analyst&location=India&f_E=1%2C2',
  },
  {
    role: 'Mobile App Developer',
    summary: 'Developing cross-platform mobile applications for iOS and Android using Flutter or React Native.',
    skills: ['Flutter', 'React Native', 'Dart', 'Mobile UI'],
    level: 'Fresher',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Mobile+App+Developer&location=India&f_E=1%2C2',
  },
  {
    role: 'Cloud Support Associate',
    summary: 'Assisting enterprise clients with cloud operations, Linux troubleshooting, and networking infrastructure.',
    skills: ['AWS', 'Linux', 'Networking', 'Troubleshooting'],
    level: 'Fresher',
    url: 'https://www.naukri.com/cloud-support-engineer-jobs-for-freshers',
  },
  {
    role: 'Data Engineer',
    summary: 'Building reliable data pipelines, ETL workflows, and big data transformation jobs.',
    skills: ['Python', 'SQL', 'Apache Spark', 'Kafka'],
    level: 'Junior',
    url: 'https://www.linkedin.com/jobs/search/?keywords=Data+Engineer&location=India&f_E=1%2C2',
  },
  {
    role: 'Business / Product Analyst',
    summary: 'Bridging engineering and business goals through product metrics, sprint analysis, and user telemetry.',
    skills: ['SQL', 'Excel', 'Product Analytics', 'Agile'],
    level: 'Fresher',
    url: 'https://www.naukri.com/business-analyst-jobs-for-freshers',
  },
]
