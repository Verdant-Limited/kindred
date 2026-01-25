<script lang="ts">
	import { fade } from 'svelte/transition';

	export let message = '';
	export let type: 'success' | 'error' | 'info' = 'info';
	export let visible = false;
	export let duration = 3000;

	let timeoutId: ReturnType<typeof setTimeout>;

	function show(msg: string, toastType: 'success' | 'error' | 'info' = 'info') {
		message = msg;
		type = toastType;
		visible = true;

		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			visible = false;
		}, duration);
	}

	const bgColor = {
		success: 'bg-green-50',
		error: 'bg-red-50',
		info: 'bg-blue-50'
	};

	const textColor = {
		success: 'text-green-700',
		error: 'text-red-700',
		info: 'text-blue-700'
	};

	const borderColor = {
		success: 'border-green-200',
		error: 'border-red-200',
		info: 'border-blue-200'
	};
</script>

{#if visible}
	<div
		class="fixed bottom-6 left-6 right-6 z-50 rounded-lg border-2 px-4 py-3 {bgColor[type]} {textColor[type]} {borderColor[type]} shadow-lg"
		transition:fade={{ duration: 200 }}>
		{message}
	</div>
{/if}
