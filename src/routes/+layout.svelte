<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex items-center justify-center">
	<div
		class="flex h-[932px] w-[430px] flex-col items-center justify-center overflow-hidden bg-stone-200">
		<div class="h-full w-full max-w-[48rem]">
			{@render children()}
		</div>
	</div>
</div>
