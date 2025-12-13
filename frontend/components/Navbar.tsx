import Link from "next/link";

const Navbar = () => {
  return (
    <nav className="relative w-full h-14 bg-yellow-600 flex items-center px-6">
      {/* Left */}
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-[#101828]">
          Dashboard
        </h1>
      </div>

      {/* Center (true center) */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Link
          href="/predictView"
          className="font-semibold text-white "
        >
          Predict View
        </Link>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-4">
        <Link
          href="/profile"
          className="text-sm text-[#3677CA] hover:underline"
        >
          Profile
        </Link>

        <button className="text-sm text-red-500 hover:underline">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
