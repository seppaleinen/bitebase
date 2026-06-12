import Link from "next/link";
import { Metadata } from "next/types";
import { JsonLd } from "@/components/json-ld";
import { cn } from "@bitebase/ui";

const SITE_URL = process.env.SITE_URL ?? "https://bitebase.labb.site";

interface Props {
  params: Promise<{ topic: string }>;
}

async function getCurriculumBySlug(slug: string) {
  const res = await fetch(
    `${SITE_URL}/api/trpc/course.getByTopicSlug?batch=1&0.slug=${encodeURIComponent(slug)}`,
    {
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result?.data?.data ?? null;
}

async function getLessonsForCurriculum(courseId: string) {
  const res = await fetch(
    `${SITE_URL}/api/trpc/course.getPublishedLessons?batch=1&0.courseId=${encodeURIComponent(courseId)}`,
    {
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data?.result?.data?.data ?? [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const course = await getCurriculumBySlug(topic);

  if (course) {
    return {
      title: `Learn ${course.title} | BiteBase`,
      description: course.description,
      alternates: {
        canonical: `${SITE_URL}/learn/${topic}`,
      },
      openGraph: {
        title: `Learn ${course.title} | BiteBase`,
        description: course.description,
        type: "website",
      },
    };
  }

  return {
    title: `Learn ${topic} | BiteBase`,
    description: `Start learning ${topic} with an AI-powered personalized course. Interactive lessons, quizzes, and progress tracking.`,
    alternates: {
      canonical: `${SITE_URL}/learn/${topic}`,
    },
    openGraph: {
      title: `Learn ${topic} | BiteBase`,
      description: `Start learning ${topic} with an AI-powered personalized course.`,
      type: "website",
    },
  };
}

export default async function LearnTopicPage({ params }: Props) {
  const { topic } = await params;
  const course = await getCurriculumBySlug(topic);
  const lessons = course ? await getLessonsForCurriculum(course.id) : [];

  const title = course?.title || topic;
  const description = course?.description || `Start learning ${topic} with an AI-powered personalized course. Interactive lessons, quizzes, and progress tracking.`;

  // JSON-LD structured data
  const jsonLd = course
    ? {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.title,
        description: course.description,
        provider: {
          "@type": "Organization",
          name: "BiteBase",
          url: SITE_URL,
        },
        courseMode: "selfpaced",
        educationalLevel: "All Levels",
        time: `${course.totalEstimatedMinutes} minutes`,
        coursePrerequisites: "None",
        learningResourceType: "Interactive Course",
        about: course.category || topic,
        hasCourseSection: (course.sections as Array<{ title: string; description: string; subsections?: Array<{ title: string; description: string }> }>)?.map((section) => ({
          "@type": "CourseSection",
          name: section.title,
          description: section.description,
          hasCourseElement: (section.subsections as Array<{ title: string; description: string }>)?.map((sub) => ({
            "@type": "Course",
            name: sub.title,
            description: sub.description,
          })),
        })),
      }
    : {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: `Learn ${title}`,
        description,
        educationalLevel: "All Levels",
        about: topic,
      };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Learn {title}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {course ? (
          <>
            {/* Curriculum Preview */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">
                Your Curriculum
              </h2>
              <div className="space-y-4">
                {(lessons as Array<{ id: string; title: string; estimatedMinutes: number }>).map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/lesson/${lesson.id}`}
                    className={cn(
                      "block p-4 rounded-xl border transition-colors",
                      "bg-slate-50 border-slate-200 hover:border-purple-300 hover:bg-purple-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">
                          {lesson.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {lesson.estimatedMinutes} min
                        </p>
                      </div>
                      <span className="text-sm text-purple-600 font-medium">
                        Start →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Interactive Quizzes
                </h3>
                <p className="text-slate-600 text-sm">
                  Test your knowledge with AI-generated quizzes after each lesson.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  AI-Generated
                </h3>
                <p className="text-slate-600 text-sm">
                  Personalized content tailored to your experience level.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Track Progress
                </h3>
                <p className="text-slate-600 text-sm">
                  See your learning streaks and progress as you go.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link
                href="/onboarding"
                className="inline-block bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Start Learning Now
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Search-to-Seed: Placeholder for missing topic */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                No course yet for {title}
              </h2>
               <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                 We haven&apos;t generated a course for this topic yet. Generate a
                 personalized course tailored to your goals and experience
                 level.
               </p>
              <Link
                href="/onboarding"
                className="inline-block bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Generate {title} Course
              </Link>
            </div>

            {/* Value Props (same as above) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Interactive Quizzes
                </h3>
                <p className="text-slate-600 text-sm">
                  Test your knowledge with AI-generated quizzes after each lesson.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  AI-Generated
                </h3>
                <p className="text-slate-600 text-sm">
                  Personalized content tailored to your experience level.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md">
                <h3 className="font-semibold text-slate-900 mb-2">
                  Track Progress
                </h3>
                <p className="text-slate-600 text-sm">
                  See your learning streaks and progress as you go.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link
                href="/onboarding"
                className="inline-block bg-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </>
        )}
      </div>

      {/* JSON-LD Structured Data */}
      <JsonLd data={jsonLd} />
    </div>
  );
}
