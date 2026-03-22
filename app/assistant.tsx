"use client";

import { useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { TreePanel } from "@/components/tree-panel";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { GitBranch, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  const [treePanelOpen, setTreePanelOpen] = useState(true);
  const isMobile = useIsMobile();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="mr-2 h-4 border-border"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/">Sapling</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>New Chat</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTreePanelOpen((prev) => !prev)}
                  aria-label={
                    treePanelOpen
                      ? "Hide conversation tree"
                      : "Show conversation tree"
                  }
                  className={
                    treePanelOpen
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  <GitBranch className="size-4" />
                </Button>
              </div>
            </header>

            <div className="relative flex flex-1 overflow-hidden">
              {/* Chat panel */}
              <div
                className={
                  treePanelOpen && !isMobile
                    ? "flex-[3] min-w-0 overflow-hidden"
                    : "flex-1 min-w-0 overflow-hidden"
                }
              >
                <Thread />
              </div>

              {/* Tree panel - desktop: inline split, mobile: overlay */}
              {treePanelOpen && (
                <>
                  {isMobile ? (
                    <div className="absolute inset-0 z-30 bg-background">
                      <div className="flex h-12 items-center justify-between border-b px-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <GitBranch className="size-4" />
                          Conversation Tree
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setTreePanelOpen(false)}
                          aria-label="Close conversation tree"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="h-[calc(100%-3rem)]">
                        <TreePanel />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Vertical divider */}
                      <div className="w-px shrink-0 bg-border" />

                      {/* Tree panel (desktop) */}
                      <div className="flex-[2] min-w-0 overflow-hidden bg-background">
                        <TreePanel />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
