<script lang="ts">
	export let show = true;
</script>

{#if show}
	<div class="space-y-4">
		<div class="h-8 w-48 animate-pulse rounded bg-gray-200"></div>
		<div class="h-6 w-full animate-pulse rounded bg-gray-100"></div>
		<div class="h-6 w-full animate-pulse rounded bg-gray-100"></div>
		<div class="h-6 w-3/4 animate-pulse rounded bg-gray-100"></div>
	</div>
{/if}
