export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8 flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-24 h-24 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          현재 서비스 점검 중입니다
        </h1>

        <p className="text-gray-400 text-lg mb-2">
          더 나은 서비스 제공을 위해 시스템 점검 작업을 진행하고 있습니다.
        </p>

        <p className="text-gray-500 text-sm mt-6">
          점검이 완료되는 대로 서비스를 재개할 예정입니다.
          <br />
          이용에 불편을 드려 죄송합니다.
        </p>

        <div className="mt-10 border-t border-gray-800 pt-6">
          <p className="text-gray-600 text-xs">3D Jewelry Trade</p>
        </div>
      </div>
    </div>
  );
}
