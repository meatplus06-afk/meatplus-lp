// Progressive enhancement: every article is visible and linked without JavaScript.
const filters=document.querySelector('[data-ed-filters]');
if(filters){
 filters.hidden=false;
 filters.addEventListener('click',event=>{
  const button=event.target.closest('button[data-ed-filter]');if(!button)return;
  const filter=button.dataset.edFilter;
  filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  let count=0;
  document.querySelectorAll('[data-ed-group]').forEach(group=>{
   group.hidden=filter!=='all'&&group.dataset.edGroup!==filter;
   if(!group.hidden)count+=group.querySelectorAll('[data-article-group]').length;
  });
  document.querySelector('[data-ed-count]').textContent=count+'記事';
 });
 // Category jump links also reset a previous filter so their target stays visible.
 document.querySelectorAll('.ed-paths a').forEach(link=>link.addEventListener('click',()=>{
  filters.querySelector('[data-ed-filter="all"]').click();
 }));
}
