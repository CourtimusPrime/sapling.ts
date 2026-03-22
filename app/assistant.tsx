"use client";

import { useChat } from "@ai-sdk/react";
import type { AssistantRuntime } from "@assistant-ui/core";
import { useRemoteThreadListRuntime } from "@assistant-ui/core/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useAuiState } from "@assistant-ui/store";
import type { ChatTransport, UIMessage } from "ai";
import { GitBranch, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { ModelSelector } from "@/components/model-selector";
import { SearchPanel } from "@/components/search-panel";
import { TreePanel } from "@/components/tree-panel";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSync } from "@/hooks/use-sync";
import { useModelStore } from "@/lib/model-store";
import { createThreadListAdapter } from "@/lib/thread-list-adapter";

/**
 * Wraps a ChatTransport in a stable Proxy so that the transport instance
 * can be swapped on re-render without breaking the useChat hook reference.
 */
function useDynamicChatTransport(
	transport: ChatTransport<UIMessage>,
): ChatTransport<UIMessage> {
	const transportRef = useRef<ChatTransport<UIMessage>>(transport);
	useEffect(() => {
		transportRef.current = transport;
	});
	return useMemo(
		() =>
			new Proxy(transportRef.current, {
				get(_, prop) {
					const res =
						transportRef.current[prop as keyof ChatTransport<UIMessage>];
					return typeof res === "function"
						? res.bind(transportRef.current)
						: res;
				},
			}),
		[],
	);
}

/**
 * Per-thread runtime hook. Called by useRemoteThreadListRuntime for each
 * thread in the list. Uses the thread list item ID from the store context
 * to scope the AI SDK chat instance.
 */
function useChatThreadRuntime(): AssistantRuntime {
	const transport = useDynamicChatTransport(
		new AssistantChatTransport({
			api: "/api/chat",
			body: () => {
				const model = useModelStore.getState().model;
				return model ? { model } : {};
			},
		}),
	);

	const id = useAuiState((s) => s.threadListItem.id);
	const chat = useChat({ id, transport });

	const runtime = useAISDKRuntime(chat);

	if (transport instanceof AssistantChatTransport) {
		transport.setRuntime(runtime);
	}

	return runtime;
}

function SyncProvider({ children }: { children: React.ReactNode }) {
	useSync();
	return <>{children}</>;
}

export const Assistant = () => {
	const adapter = useMemo(() => createThreadListAdapter(), []);
	const runtime = useRemoteThreadListRuntime({
		runtimeHook: useChatThreadRuntime,
		adapter,
	});

	const [treePanelOpen, setTreePanelOpen] = useState(true);
	const [searchOpen, setSearchOpen] = useState(false);
	const isMobile = useIsMobile();

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<SyncProvider>
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

								<div className="ml-auto flex items-center gap-2">
									<ModelSelector />
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => {
											setSearchOpen((prev) => !prev);
											if (!searchOpen && !treePanelOpen) {
												setTreePanelOpen(true);
											}
										}}
										aria-label={
											searchOpen
												? "Close search"
												: "Search messages"
										}
										className={
											searchOpen
												? "text-foreground"
												: "text-muted-foreground"
										}
									>
										<Search className="size-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => {
											setTreePanelOpen((prev) => !prev);
											if (treePanelOpen && searchOpen) {
												setSearchOpen(false);
											}
										}}
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
								{treePanelOpen &&
									(isMobile ? (
										<div className="absolute inset-0 z-30 bg-background">
											<div className="flex h-12 items-center justify-between border-b px-3">
												<span className="flex items-center gap-2 text-sm font-medium text-foreground">
													{searchOpen ? (
														<>
															<Search className="size-4" />
															Search Messages
														</>
													) : (
														<>
															<GitBranch className="size-4" />
															Conversation Tree
														</>
													)}
												</span>
												<Button
													variant="ghost"
													size="icon-sm"
													onClick={() => {
														setTreePanelOpen(false);
														setSearchOpen(false);
													}}
													aria-label="Close panel"
												>
													<X className="size-4" />
												</Button>
											</div>
											<div className="h-[calc(100%-3rem)]">
												{searchOpen ? (
													<SearchPanel
														onClose={() => setSearchOpen(false)}
													/>
												) : (
													<TreePanel />
												)}
											</div>
										</div>
									) : (
										<>
											{/* Vertical divider */}
											<div className="w-px shrink-0 bg-border" />

											{/* Right panel (desktop) */}
											<div className="flex-[2] min-w-0 overflow-hidden bg-background flex flex-col">
												{searchOpen && (
													<>
														<div className="shrink-0 max-h-[50%] overflow-hidden border-b">
															<SearchPanel
																onClose={() => setSearchOpen(false)}
															/>
														</div>
													</>
												)}
												<div className="flex-1 min-h-0 overflow-hidden">
													<TreePanel />
												</div>
											</div>
										</>
									))}
							</div>
						</SidebarInset>
					</div>
				</SidebarProvider>
			</SyncProvider>
		</AssistantRuntimeProvider>
	);
};
