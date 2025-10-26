<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<!-- Responsive app shell with safe-area support -->
<div class="min-h-[100dvh] w-full bg-stone-200">
	<div
		class="mx-auto min-h-[100dvh] w-full max-w-[430px] overflow-hidden
               pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)]
               pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
		<div class="min-h-[100dvh]">
			{@render children()}
		</div>
	</div>
</div>
