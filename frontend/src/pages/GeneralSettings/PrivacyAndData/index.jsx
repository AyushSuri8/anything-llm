import { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import System from "@/models/system";
import PreLoader from "@/components/Preloader";
import { useTranslation } from "react-i18next";
import ProviderPrivacy from "@/components/ProviderPrivacy";

export default function PrivacyAndDataHandling() {
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      await System.keys();
      setLoading(false);
    }
    fetchSettings();
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] light:border light:border-theme-sidebar-border bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
          <div className="w-full flex flex-col gap-y-1 pb-6 border-white/10 border-b-2">
            <div className="items-center flex gap-x-4">
              <p className="text-lg leading-6 font-bold text-theme-text-primary">
                {t("privacy.title")}
              </p>
            </div>
            <p className="text-xs leading-[18px] font-base text-theme-text-secondary">
              {t("privacy.description")}
            </p>
          </div>
          {loading ? (
            <div className="h-1/2 transition-all duration-500 relative md:ml-[2px] md:mr-[8px] md:my-[16px] md:rounded-[26px] p-[18px] h-full overflow-y-scroll">
              <div className="w-full h-full flex justify-center items-center">
                <PreLoader />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto flex flex-col gap-y-6 pt-6">
              <ProviderPrivacy />
              <div className="relative w-full max-h-full">
                <div className="relative rounded-lg">
                  <div className="flex flex-col items-left space-y-2">
                    <p className="text-theme-text-secondary text-xs rounded-lg w-96">
                      Anonymous telemetry has been <b>removed</b> from
                      UsingOpen. No usage events are collected, no IDs are
                      created, and no network calls are made.
                    </p>
                    <p className="text-theme-text-secondary text-xs rounded-lg w-96">
                      As an open-source project we respect your right to
                      privacy. We are dedicated to building the best solution
                      for integrating AI and documents privately and securely.
                      If you have feedback and thoughts so that we can continue
                      to improve UsingOpen for you,{" "}
                      <a
                        href="mailto:support@usingopen.com"
                        className="underline text-blue-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        support@usingopen.com
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
