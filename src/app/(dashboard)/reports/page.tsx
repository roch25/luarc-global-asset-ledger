import type { Metadata } from 'next'
import Image from 'next/image'
import flashImg from '@/app/public/flash.png'

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Graphs, visual analytics, and portfolio reporting.',
}

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl tracking-tight text-neutral-950">Reports</h1>
      </header>

      <div className="flex justify-center sm:py-12">
        <div className="w-fit overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
          <Image
            src={flashImg}
            alt="Reports preview flash"
            priority
            className="mx-auto h-auto w-full max-w-3xl rounded-md"
          />
        </div>
      </div>
    </div>
  )
}
